"""CoinPoker 토너먼트 핸드 히스토리 → 활동 원장 (비용 쪽만).

    python tools/parse_coinpoker.py <핸드파일.txt> [--out reality/poker/ledger_<날짜>.json]

이 파서가 할 수 있는 것과 없는 것을 먼저 분명히 한다.

할 수 있다
  · 핸드 수, 기간, 월별 분포
  · 고유 토너먼트 ID 수 (= 참가 하한)
  · 토너먼트 이름에서 바이인 추출 → 월별 바이인 원가 **하한**
  · 게임 종류·테이블 크기·Hero 참여 핸드

할 수 없다 — 파일에 그 정보가 없다
  · **상금·바운티·순손익.** 핸드 히스토리에는 payout/prize/bounty 라인이 전혀 없다(실측 확인).
  · **입출금.** 플랫폼 거래 내역이 따로 있어야 한다.
  · **재참가·리바이·애드온 횟수.** 아래 휴리스틱은 후보일 뿐 확정이 아니다.
  · **수수료.** 토너먼트 이름의 ₮ 표기에 수수료가 포함되는지 이 파일로는 모른다.

따라서 이 원장으로 ROI 나 순손익을 계산하지 않는다.
docs/POKER_LEDGER_SPEC.md 4번(총 원가 미확보 시 ROI=null)과 6번(ID 개수·공식 Played·
re-entry 를 각각 독립 계산)을 그대로 따른다.

개인정보: 상대 플레이어 별칭·홀카드·보드는 읽지 않고 버린다. 출력에는 토너먼트 이름(공개
상품명)·ID·시각·집계만 남는다. 원본 파일은 저장소에 커밋하지 않는다(docs/PRIVACY.md).
"""
import argparse
import collections
import json
import re
import sys
from datetime import datetime
from pathlib import Path

CONTRACT = "coinpoker-ledger/1"

# 게임 이름에 공백이 들어간다('PLO 4'). \S+ 로 받으면 그 핸드가 통째로 빠진다.
RE_HAND = re.compile(
    r"^CoinPoker Hand #(?P<hand>\d+): (?P<game>.+?) \([^)]*\) "
    r"(?P<date>\d{4}/\d{2}/\d{2}) (?P<time>\d{2}:\d{2}:\d{2}) (?P<tz>\S+)"
)
# 토너먼트 이름에 아포스트로피가 들어간다("Lil' Kahuna"). [^']* 로 받으면 그 대회가
# 통째로 빠진다 — 실제로 47핸드가 그렇게 사라졌다. 이름은 greedy 로 받고 뒤의
# 숫자 ID 로 경계를 잡는다.
RE_TOURNEY = re.compile(
    r"^Tournament '(?P<name>.+)' '(?P<tid>\d+)' (?P<max>\d+)-max"
)
RE_HERO_SEAT = re.compile(r"^Seat \d+: Hero \(([\d,]+(?:\.\d+)?) in chips\)")

# 이름에서 바이인을 읽는다. 첫 번째 ₮/$ 금액이 바이인이지만 예외가 있다.
RE_MONEY = re.compile(r"[₮$]\s*([\d,]+(?:\.\d+)?)")
RE_SATELLITE = re.compile(r"\bStep\s*\[?\d*\]?\s*to\b", re.I)
RE_FREEROLL = re.compile(r"freeroll", re.I)


def parse_buyin(name):
    """(금액, 판정사유) 를 돌려준다. 모르면 (None, 사유).

    **추측하지 않는다.** 새털라이트 이름의 ₮ 는 목표 상금이지 참가비가 아니다.
    여기서 그걸 바이인으로 읽으면 원가가 수십 배 부풀고, 그 값이 '직접확인' 자격을
    얻어 맞는 기록을 이긴다.
    """
    if RE_FREEROLL.search(name):
        return 0.0, "freeroll"
    if RE_SATELLITE.search(name):
        return None, "satellite_target_not_buyin"
    m = RE_MONEY.search(name)
    if not m:
        return None, "no_amount_in_name"
    return float(m.group(1).replace(",", "")), "parsed_from_name"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    src = Path(args.source)
    if not src.exists():
        sys.exit(f"원본 파일 없음: {src}")

    hands = 0
    bad_header = 0
    cur = None
    tz_seen = collections.Counter()
    games = collections.Counter()
    months = collections.defaultdict(lambda: {"hands": 0, "tournaments": set()})
    # tid -> 집계
    tour = {}

    with src.open(encoding="utf-8", errors="replace") as f:
        for line in f:
            if line.startswith("CoinPoker Hand #"):
                m = RE_HAND.match(line)
                if not m:
                    bad_header += 1
                    cur = None
                    continue
                hands += 1
                cur = {"date": m.group("date"), "time": m.group("time")}
                tz_seen[m.group("tz")] += 1
                games[m.group("game")] += 1
                continue

            if cur is not None and line.startswith("Tournament '"):
                m = RE_TOURNEY.match(line)
                if not m:
                    cur = None
                    continue
                tid = m.group("tid")
                name = m.group("name").replace("\xa0", " ").strip()
                ts = f"{cur['date']} {cur['time']}"
                rec = tour.get(tid)
                if rec is None:
                    buyin, why = parse_buyin(name)
                    rec = tour[tid] = {
                        "tournament_id": tid, "name": name,
                        "buyin": buyin, "buyin_basis": why,
                        "max_seats": int(m.group("max")),
                        "hands": 0, "first_seen": ts, "last_seen": ts,
                        "hero_stacks": [],
                    }
                rec["hands"] += 1
                if ts < rec["first_seen"]:
                    rec["first_seen"] = ts
                if ts > rec["last_seen"]:
                    rec["last_seen"] = ts
                mk = cur["date"][:7].replace("/", "-")
                months[mk]["hands"] += 1
                months[mk]["tournaments"].add(tid)
                cur["tid"] = tid
                continue

            if cur is not None and "tid" in cur and line.startswith("Seat "):
                m = RE_HERO_SEAT.match(line)
                if m:
                    tour[cur["tid"]]["hero_stacks"].append(
                        float(m.group(1).replace(",", "")))

    # --- 재참가 후보 (휴리스틱. 확정 아님) ---------------------------------
    # Hero 스택이 시작 스택의 절반 아래로 떨어졌다가 시작 스택 수준으로 되돌아오면
    # 버스트 후 재진입일 수 있다. 큰 팟을 이겨도 같은 모양이 나오므로 **상한도 하한도
    # 아닌 후보**다. 확정 값은 플랫폼 원장에만 있다.
    for rec in tour.values():
        stacks = rec.pop("hero_stacks")
        start = stacks[0] if stacks else None
        resets = 0
        if start:
            low = False
            for s in stacks[1:]:
                if s < start * 0.5:
                    low = True
                elif low and s >= start * 0.95:
                    resets += 1
                    low = False
        rec["hero_hands"] = len(stacks)
        rec["reentry_candidates"] = resets

    # --- 월별 집계 ---------------------------------------------------------
    monthly = {}
    for mk in sorted(months):
        tids = months[mk]["tournaments"]
        known = [tour[t]["buyin"] for t in tids if tour[t]["buyin"] is not None]
        unknown = [t for t in tids if tour[t]["buyin"] is None]
        monthly[mk] = {
            "hands": months[mk]["hands"],
            "unique_tournament_ids": len(tids),
            "buyin_known_count": len(known),
            "buyin_unknown_count": len(unknown),
            "buyin_sum_lower_bound": round(sum(known), 2),
            "buyin_currency": "CoinPoker ₮ (표기 그대로. USD/USDT 와 동일 단위인지 미확인)",
            "note": ("바이인 합계는 고유 토너먼트 ID 1개당 1회 참가로 계산한 **하한**이다. "
                     "재참가·리바이·애드온·수수료가 빠져 있고, 바이인 미상 토너먼트는 0 으로 "
                     "세지 않고 개수로만 남겼다."),
        }

    tours = sorted(tour.values(), key=lambda r: r["first_seen"])
    all_known = [r["buyin"] for r in tours if r["buyin"] is not None]
    unknown_names = sorted({r["name"] for r in tours if r["buyin"] is None})

    out = {
        "contract": CONTRACT,
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "source_file": src.name,
        "source_bytes": src.stat().st_size,
        "source_committed": False,
        "timezone_in_file": dict(tz_seen),
        "capability_note": (
            "이 파일에는 상금·바운티·입출금·수수료 라인이 없다(실측 확인). "
            "따라서 순손익·ROI 를 계산하지 않는다. 비용 쪽 하한만 낸다."
        ),
        "totals": {
            "hands": hands,
            "malformed_headers": bad_header,
            "unique_tournament_ids": len(tours),
            "period_first": tours[0]["first_seen"] if tours else None,
            "period_last": tours[-1]["last_seen"] if tours else None,
            "buyin_known_count": len(all_known),
            "buyin_unknown_count": len(tours) - len(all_known),
            "buyin_sum_lower_bound": round(sum(all_known), 2),
            "reentry_candidates_total": sum(r["reentry_candidates"] for r in tours),
        },
        "games": dict(games),
        "monthly": monthly,
        "buyin_unknown_names": unknown_names,
        "tournaments": tours,
    }

    dest = Path(args.out) if args.out else Path(
        f"reality/poker/ledger_{datetime.now():%Y%m%d}.json")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8", newline="\n")

    w = sys.stdout
    try:
        w.reconfigure(encoding="utf-8")
    except Exception:
        pass
    t = out["totals"]
    print(f"핸드 {t['hands']:,} · 토너먼트 {t['unique_tournament_ids']:,} "
          f"· {t['period_first']} ~ {t['period_last']}")
    print(f"바이인 하한 합계 ₮{t['buyin_sum_lower_bound']:,.2f} "
          f"(미상 {t['buyin_unknown_count']}개 제외) · 재참가 후보 {t['reentry_candidates_total']}")
    for mk, v in monthly.items():
        print(f"  {mk}  핸드 {v['hands']:6,}  토너먼트 {v['unique_tournament_ids']:4,}  "
              f"바이인 하한 ₮{v['buyin_sum_lower_bound']:>9,.2f}  미상 {v['buyin_unknown_count']}")
    print(f"→ {dest}")


if __name__ == "__main__":
    main()
