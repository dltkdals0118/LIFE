"""저장소 <-> 웹 자동 동기화. JSON 파일을 사람이 주고받지 않는다. 작성: WACUS

  올려보내는 것: 시뮬레이션(sim) · 관측(observations) — 엔진이 만든 것
  받아오는 것  : 일기(journal) — 웹에서 쓴 것

**덮어쓰지 않는다.** 서버 것을 먼저 받아, 엔진이 주인인 칸만 갈아끼우고 나머지는 그대로 돌려보낸다.
웹에서 쓴 일기가 이 과정에서 지워지면 안 된다.

자격증명은 `.env.local`(git 제외)에서 읽는다. 사용자 결정 2026-11-09: **앱 계정 비밀번호**를 쓴다
— service_role 키는 RLS 를 우회해 전체 DB 권한이라 새면 피해 범위가 크다.
"""
import json
import sys
import uuid
import urllib.error
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KST = timezone(timedelta(hours=9))
ENV = ROOT / ".env.local"
MINE = ("sim", "observations", "curriculum")              # 엔진이 주인인 칸
THEIRS = ("journal", "simPicks", "curriculumDone")        # 웹이 주인인 칸 — 덮지 않는다


def env():
    """.env.local 을 읽는다. 없으면 무엇을 적어야 하는지 알려주고 멈춘다."""
    if not ENV.exists():
        raise SystemExit(
            "자격증명이 없다. {} 를 만들고 네 줄을 적는다:\n"
            "  LIFE_SUPABASE_URL=https://<프로젝트>.supabase.co\n"
            "  LIFE_SUPABASE_KEY=sb_publishable_...\n"
            "  LIFE_EMAIL=<앱에 로그인하는 메일>\n"
            "  LIFE_PASSWORD=<그 비밀번호>\n"
            "이 파일은 .gitignore 에 있다. 커밋되지 않는다.".format(ENV)
        )
    out = {}
    for line in ENV.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip().strip('"').strip("'")
    missing = [k for k in ("LIFE_SUPABASE_URL", "LIFE_SUPABASE_KEY", "LIFE_EMAIL", "LIFE_PASSWORD")
               if not out.get(k)]
    if missing:
        raise SystemExit("{} 에 빠진 값: {}".format(ENV, ", ".join(missing)))
    return out


def call(url, key, path, body=None, token=None, method=None):
    headers = {"apikey": key, "Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url.rstrip("/") + path, data=data, headers=headers,
                                 method=method or ("POST" if data else "GET"))
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read().decode("utf-8")
            return json.loads(raw) if raw.strip() else None
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:400]
        raise SystemExit("요청 실패 {} {} — {}".format(e.code, path, detail))
    except urllib.error.URLError as e:
        raise SystemExit("연결 실패 {} — {}".format(path, e.reason))


def login(cfg):
    r = call(cfg["LIFE_SUPABASE_URL"], cfg["LIFE_SUPABASE_KEY"],
             "/auth/v1/token?grant_type=password",
             {"email": cfg["LIFE_EMAIL"], "password": cfg["LIFE_PASSWORD"]})
    if not r or not r.get("access_token"):
        raise SystemExit("로그인은 됐는데 토큰이 없다. 메일 확인이 끝났는지 본다.")
    return r["access_token"], r["user"]["id"]


def fetch(cfg, token, uid):
    rows = call(cfg["LIFE_SUPABASE_URL"], cfg["LIFE_SUPABASE_KEY"],
                "/rest/v1/life_workspaces?select=data,revision&user_id=eq." + uid,
                token=token)
    return (rows or [None])[0]


def save(cfg, token, data, revision):
    mutation = str(uuid.uuid4())      # RPC 가 uuid 를 요구한다. 문자열 ID 는 400 으로 거부된다.
    r = call(cfg["LIFE_SUPABASE_URL"], cfg["LIFE_SUPABASE_KEY"],
             "/rest/v1/rpc/save_life_workspace",
             {"expected_revision": revision, "new_data": data, "mutation_id": mutation},
             token=token)
    if isinstance(r, dict) and r.get("conflict"):
        return None, "웹에서 먼저 바뀌었다(충돌). 다시 돌리면 받아온 뒤 올린다."
    return r, None


def local_import():
    p = ROOT / "private_raw" / "life-app-import.json"
    if not p.exists():
        raise SystemExit("먼저 python tools/build_app_import.py 를 돌린다 — {} 가 없다.".format(p))
    return json.loads(p.read_text(encoding="utf-8"))


def save_journal(entries):
    """웹에서 쓴 일기를 저장소로 받아 적는다. 하루 한 파일."""
    if not entries:
        return []          # 빈 폴더를 만들면 훅이 그걸 커밋하려다 실패한다(git 은 빈 디렉터리를 모른다)
    out = ROOT / "journal"
    out.mkdir(exist_ok=True)
    wrote = []
    for e in entries:
        f = out / "{}.md".format(e["date"])
        mood = "\n\n컨디션: {}/5".format(e["mood"]) if e.get("mood") else ""
        body = "# {}\n\n{}{}\n".format(e["date"], e["text"].replace("\r\n", "\n"), mood)
        if not f.exists() or f.read_text(encoding="utf-8") != body:
            f.write_text(body, encoding="utf-8", newline="\n")
            wrote.append(e["date"])
    return wrote


def main():
    cfg = env()
    token, uid = login(cfg)
    row = fetch(cfg, token, uid)
    mine = local_import()

    if row is None:
        remote, revision = {}, 0
        note = "서버에 공간이 없어 새로 만든다"
    else:
        remote, revision = row["data"], row["revision"]
        note = "서버 revision {}".format(revision)

    # 1) 받아오기 — 일기는 웹이 주인이다
    got = save_journal(remote.get("journal") or [])

    # 2) 올려보내기 — 서버 것을 바탕으로, 엔진이 주인인 칸만 갈아끼운다
    merged = dict(remote) if remote else dict(mine)
    for k, v in mine.items():
        if k in THEIRS:
            continue                      # 웹 것을 덮지 않는다
        if k in MINE or k not in merged:
            merged[k] = v
    for k in THEIRS:                      # 서버에 있던 것을 그대로 보존
        merged[k] = remote.get(k, merged.get(k, []))
    merged["schemaVersion"] = 1

    same = remote and all(json.dumps(merged.get(k), sort_keys=True, ensure_ascii=False)
                          == json.dumps(remote.get(k), sort_keys=True, ensure_ascii=False)
                          for k in MINE)
    if same:
        print("동기화: 올릴 것 없음 · {}{}".format(
            note, " · 일기 {}건 받음".format(len(got)) if got else ""))
        return 0

    _, err = save(cfg, token, merged, revision)
    if err:
        print("동기화: " + err)
        return 1
    levers = len((merged.get("sim") or {}).get("levers") or [])
    print("동기화: 올렸다 — 손잡이 {}개 · 관측 {}개{}".format(
        levers, len(merged.get("observations") or []),
        " · 일기 {}건 받음".format(len(got)) if got else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
