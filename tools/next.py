# -*- coding: utf-8 -*-
"""LIFE — 지금 이어갈 자리를 출력한다. 작성: WACUS

    python tools/next.py            # 사람·에이전트 둘 다 읽는 요약
    python tools/next.py --json     # 기계용

이 스크립트는 **판정하지 않는다. 관측값만 낸다**(AGENTS.md / 수집 우선 규칙).
- 아무것도 쓰지 않는다. 읽기 전용이다.
- 실패는 값이 아니다. 못 읽은 항목은 null 과 사유를 낸다.
- 날짜를 지어내지 않는다. 시스템 시각을 그대로 쓴다.
"""
import argparse
import datetime as dt
import json
import os
import re
import subprocess
import sys

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLAN_START = dt.date(2026, 10, 29)   # 90일 계획 시작 (execution/2026-10-29-plan-90days.md)
PLAN_DAYS = 90  # 90일 뒤 = PLAN_START + 90d = 2027-01-27 (문서와 같은 셈법)
WEEKS_DOC = "execution/2026-10-29-weeks-01-04.md"
TRACKERS = [
    ("G1-spend", "지출·현금", "1순위"),
    ("G3-poker", "포커 손익", "G1 의 측정 도구"),
    ("G4-stability", "수면·건강", "안정화 둘째 축"),
    ("G2-outreach", "아웃바운드", "후순위"),
]
WD = "월화수목금토일"


def rd(rel):
    p = os.path.join(ROOT, rel)
    if not os.path.exists(p):
        return None
    with open(p, encoding="utf-8") as f:
        return f.read()


def week_windows(doc):
    """weeks 문서의 '## W1 — 10/29(목) ~ 11/01(일)' 머리글에서 기간을 읽는다.
    하드코딩하지 않는다 — 문서가 바뀌면 이 출력도 따라 바뀌어야 한다."""
    out = []
    if not doc:
        return out
    pat = re.compile(r"^## (W\d+) — (\d{1,2})/(\d{1,2})[^~\n]*~ (\d{1,2})/(\d{1,2})", re.M)
    for m in pat.finditer(doc):
        name, m1, d1, m2, d2 = m.group(1), *map(int, m.groups()[1:])
        y1 = PLAN_START.year if m1 >= PLAN_START.month else PLAN_START.year + 1
        y2 = PLAN_START.year if m2 >= PLAN_START.month else PLAN_START.year + 1
        out.append((name, dt.date(y1, m1, d1), dt.date(y2, m2, d2), m.start()))
    return out


def section(doc, start_idx):
    """그 머리글부터 다음 '## ' 까지"""
    nxt = doc.find("\n## ", start_idx + 1)
    return doc[start_idx: nxt if nxt != -1 else len(doc)].rstrip()


def month_end(y, m):
    return dt.date(y + (m == 12), 1 if m == 12 else m + 1, 1) - dt.timedelta(days=1)


def blanks(rel):
    """표 행(| 로 시작)에서만 센다. 본문 산문의 'null' 을 세면 수치가 부풀려진다."""
    t = rd(rel)
    if t is None:
        return {"null": None, "미시작": None, "note": "파일 없음"}
    rows = [l for l in t.splitlines() if l.lstrip().startswith("|")]
    return {"null": sum(l.count("null") for l in rows),
            "미시작": sum(l.count("미시작") for l in rows), "note": None}


def git(*args):
    try:
        return subprocess.run(["git", "-C", ROOT, *args], capture_output=True,
                              text=True, encoding="utf-8", errors="replace",
                              timeout=20).stdout.strip()
    except Exception as e:
        return f"(git 실패: {e})"


def open_decisions():
    t = rd("state/OPEN_QUESTIONS.md") or ""
    out = []
    for l in t.splitlines():
        if l.lstrip().startswith("|") and "열림" in l and re.search(r"D-\d{3}", l):
            cells = [c.strip() for c in l.strip().strip("|").split("|")]
            if len(cells) >= 2:
                out.append(" — ".join(c.replace("**", "") for c in cells[:2]))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()

    today = dt.date.today()
    elapsed = (today - PLAN_START).days
    end = PLAN_START + dt.timedelta(days=PLAN_DAYS)

    doc = rd(WEEKS_DOC)
    weeks = week_windows(doc)
    cur = next((w for w in weeks if w[1] <= today <= w[2]), None)

    miles = [("30일 관문", PLAN_START + dt.timedelta(days=30)),
             ("11월 월간 검토", month_end(2026, 11)),
             ("60일 점검", PLAN_START + dt.timedelta(days=60)),
             ("12월 월간 검토", month_end(2026, 12)),
             ("90일 종료 · 기준점 v2", end)]

    data = {
        "as_of": today.isoformat(),
        "plan": {"start": PLAN_START.isoformat(), "end": end.isoformat(),
                 "elapsed_days": elapsed, "of": PLAN_DAYS},
        "week": cur[0] if cur else None,
        "milestones": [{"name": n, "date": d.isoformat(), "d_day": (d - today).days} for n, d in miles],
        "trackers": {k: blanks(f"execution/trackers/{k}.md") for k, _, _ in TRACKERS},
        "open_decisions": open_decisions(),
        "git": {"last_commit": git("log", "--oneline", "-1"),
                "dirty": git("status", "--porcelain")},
    }

    if a.json:
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return

    P = print
    P(f"LIFE — 지금 이어갈 자리{'':8}{today} ({WD[today.weekday()]})")
    P("작성: WACUS · 이 스크립트는 판정하지 않는다. 관측값만 낸다.")
    P("")
    P("[우선순위]  1순위 G1 지출 절감 · G3 측정 도구 · G4 수면 · G2 후순위   (DEC-001 · DEC-002)")
    P("[목적지]    적자 0 + 수면·건강 — 레버 전부 약 148만, 약 117만은 수입 몫")
    P("")
    if elapsed < 0:
        P(f"[90일]  {PLAN_START} ~ {end} · 시작 전 ({-elapsed}일 남음)")
    elif elapsed > PLAN_DAYS:
        P(f"[90일]  {PLAN_START} ~ {end} · **종료됨** ({elapsed - PLAN_DAYS}일 지남) — 기준점 v2 를 만들 차례다")
    else:
        P(f"[90일]  {PLAN_START} ~ {end} · 경과 {elapsed}일 / {PLAN_DAYS}" + (f" · 이번 주 = {cur[0]}" if cur else " · 주간 계획 밖(월간 주기)"))
    P("")
    P("[다음 마일스톤]")
    for n, d in miles:
        dd = (d - today).days
        tag = f"D-{dd}" if dd > 0 else ("오늘" if dd == 0 else f"{-dd}일 지남")
        P(f"  {d} ({WD[d.weekday()]})  {n:<22} {tag}")
    P("")
    P("[기록 상태]  빈 칸 = 아직 숫자가 없다")
    for k, label, role in TRACKERS:
        b = data["trackers"][k]
        if b["note"]:
            P(f"  {k:<13} {label:<8} {b['note']}")
        else:
            P(f"  {k:<13} {label:<8} null {b['null']:>3} · 미시작 {b['미시작']:>2}   ({role})")
    tot = sum((b["null"] or 0) + (b["미시작"] or 0) for b in data["trackers"].values())
    if tot and not any(b["note"] for b in data["trackers"].values()):
        P("  → 빈칸이 남아 있다. 최신 실측과 다음 행동은 state/STATUS.md 를 확인한다.")
    P("")
    if cur and doc:
        P(f"[이번 주 행동]  {WEEKS_DOC}")
        P("")
        P(section(doc, cur[3]))
    else:
        P(f"[이번 주 행동]  주간 계획({WEEKS_DOC}) 범위 밖이다. 월간 검토 주기로 간다.")
    P("")
    if data["open_decisions"]:
        P("[열린 결정]")
        for d in data["open_decisions"]:
            P(f"  {d}")
        P("")
    P(f"[마지막 커밋]  {data['git']['last_commit']}")
    P(f"[작업트리]     {'깨끗함' if not data['git']['dirty'] else '변경 있음 — 커밋 전'}")
    if data["git"]["dirty"]:
        for l in data["git"]["dirty"].splitlines()[:12]:
            P(f"  {l}")


if __name__ == "__main__":
    main()
