"""입력함 한 줄 -> 사실 -> 파생값 -> NOW.md -> 앱 데이터. 커밋 훅이 부른다. 작성: WACUS

엔진은 판정하지 않는다. 숫자와 '왜 못 구했는지'만 낸다.
모르는 값을 0 으로 채우지 않는다(AGENTS.md).
파생값은 reality/ 에 쓰지 않는다(DATA_CONTRACT: simulated 는 simulation 전용).
"""
import hashlib
import json
import re
import subprocess
import sys
from datetime import date, datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KST = timezone(timedelta(hours=9))

# 입력 항목 -> (domain, fact key, unit). 목록에 없는 이름은 막는다 — 오타가 기록을 날리는 것보다 낫다.
KINDS = {
    "cash": ("재정", "available_cash", "KRW"),
    "spend": ("재정", "monthly_outflow", "KRW"),
    "inflow": ("재정", "monthly_inflow", "KRW"),
    "debt": ("재정", "total_debt", "KRW"),
    "debt_payment": ("재정", "monthly_debt_payment", "KRW"),
    "income": ("재정", "monthly_net_income", "KRW"),
    "rate": ("재정", "debt_interest_rate", "percent"),
    "rent": ("생활", "housing_cost", "KRW"),
    "poker-out": ("포커", "poker_out", "KRW"),
    "poker-in": ("포커", "poker_in", "KRW"),
    "poker-hours": ("포커", "poker_hours", "hour"),
    "sleep": ("건강", "sleep_hours", "hour"),
    "weight": ("건강", "weight", "kg"),
    "exercise": ("건강", "exercise_minutes", "minute"),
    "steps": ("건강", "steps", "count"),
    "mood": ("건강", "mood", "score"),
    "hours": ("시간", "weekly_available_hours", "hour/week"),
    "study": ("시간", "study_minutes", "minute"),
    "late": ("직장", "lateness_count", "count"),
    "offer_net": ("직장", "offer_net_monthly", "KRW"),
}
# 파생 계산이 찾는 값 -> 그 값을 담을 수 있는 fact key 들 (새 이름 먼저, 옛 이름 뒤)
LOOKUP = {
    "cash": ["available_cash", "current_cash", "cash_history"],
    "income": ["monthly_net_income", "current_monthly_net_salary"],
    "spend": ["monthly_outflow"],
    "inflow": ["monthly_inflow"],
    "debt": ["total_debt", "current_total_debt"],
    "debt_payment": ["monthly_debt_payment", "current_monthly_debt_payment"],
    "offer_net": ["offer_net_monthly"],
}
# 비어 있을 때 사람에게 보여줄 '이 줄을 적으면 채워진다'
HOWTO = {
    "cash": "cash  <지금 쓸 수 있는 현금>",
    "income": "income  <세후 월 수입>",
    "spend": "spend  <한 달에 나간 돈 전부(채무 납입·이체 포함)>",
    "inflow": "inflow  <한 달에 들어온 돈 전부(월급 외 포함)>",
    "debt": "debt  <채무 잔액>",
    "debt_payment": "debt_payment  <매달 갚는 금액>",
    "offer_net": "offer_net  <오퍼의 세후 월급>",
}
LABEL = {
    "cash": "가용 현금", "income": "세후 월 수입", "spend": "월 총유출",
    "inflow": "월 총유입", "debt": "채무 잔액", "debt_payment": "월 채무 납입",
    "offer_net": "오퍼 세후 월급",
}


def won(n):
    return "{:,}원".format(int(n))


def write(path, text):
    """LF 로 쓴다. 내용이 같으면 쓰지 않는다 — 쓰면 mtime 이 바뀌어 변경으로 잡힌다."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    if path.exists() and path.read_text(encoding="utf-8").replace("\r\n", "\n") == text:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")
    return True


def load(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def save(name, data):
    return write(ROOT / name, json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def next_id(items, prefix):
    n = 0
    for it in items:
        m = re.fullmatch(prefix + r"-(\d+)", it.get("id", ""))
        if m:
            n = max(n, int(m.group(1)))
    width = 4 if prefix == "FACT" else 3
    return lambda i=0: "{}-{:0{}d}".format(prefix, n + 1 + i, width)


def read_inbox():
    """한 줄 = 한 관측. 탭 또는 공백 2칸 이상으로 나눈다."""
    rows, errors = [], []
    path = ROOT / "input" / "inbox.tsv"
    if not path.exists():
        return rows, errors
    for lineno, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in re.split(r"\t|\s{2,}", line) if p.strip()]
        if len(parts) < 3:
            errors.append("{}행: 칸이 셋(날짜·항목·값)은 되어야 한다 — {!r}".format(lineno, line))
            continue
        date, kind, value = parts[0], parts[1], parts[2]
        rest = parts[3:]
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
            errors.append("{}행: 날짜가 YYYY-MM-DD 가 아니다 — {!r}".format(lineno, date))
            continue
        if kind not in KINDS:
            errors.append("{}행: 모르는 항목 {!r}. input/README.md 의 목록을 쓴다".format(lineno, kind))
            continue
        try:
            num = float(value.replace(",", "").replace("_", ""))
        except ValueError:
            errors.append("{}행: 값이 숫자가 아니다 — {!r}".format(lineno, value))
            continue
        note = " ".join(rest)
        key = "{}|{}|{}|{}".format(date, kind, num, note)
        rows.append({
            "line": lineno, "date": date, "kind": kind,
            "value": int(num) if num == int(num) else num,
            "note": note,
            "hash": hashlib.sha256(key.encode("utf-8")).hexdigest()[:16],
        })
    return rows, errors


def apply_inbox(rows):
    """새 줄만 사실로 넣는다. 같은 줄을 두 번 반영하지 않는다."""
    ledger = load("input/.applied.json")
    seen = set(ledger["applied"])
    fresh = [r for r in rows if r["hash"] not in seen]
    if not fresh:
        return []
    facts = load("reality/facts.json")
    sources = load("reality/sources.json")
    fid = next_id(facts["facts"], "FACT")
    sid = next_id(sources["sources"], "SRC")
    now = datetime.now(KST).isoformat(timespec="seconds")
    added = []
    for i, r in enumerate(fresh):
        domain, key, unit = KINDS[r["kind"]]
        s, f = sid(i), fid(i)
        summary = "{} = {}".format(r["kind"], r["value"])
        if r["note"]:
            summary += " · " + r["note"]
        sources["sources"].append({
            "id": s, "type": "document",
            "title": "{} 입력함 — {}".format(r["date"], r["kind"]),
            "stated_at": r["date"], "checked_at": now,
            "locator": "input/inbox.tsv:{}".format(r["line"]),
            "redacted_summary": summary,
            "access_mode": "local_file",
            "limitation": "본인이 직접 적은 값이다. 자료로 대조하지 않았다.",
        })
        facts["facts"].append({
            "id": f, "domain": domain, "key": key, "value": r["value"], "unit": unit,
            "kind": "self_report", "as_of": r["date"], "recorded_at": now,
            "source_ids": [s], "range": None, "sensitivity": "personal",
            "review_status": "draft", "supersedes": None,
            "note": r["note"] or "입력함에서 자동 반영",
        })
        ledger["applied"].append(r["hash"])
        added.append("{} {}={} ({})".format(f, r["kind"], r["value"], r["date"]))
    save("reality/facts.json", facts)
    save("reality/sources.json", sources)
    save("input/.applied.json", ledger)
    return added


def latest(facts, names):
    """as_of 가 가장 최근인 값. 숫자가 아닌 값(dict 등)은 건너뛴다."""
    best = None
    for f in facts:
        if (f.get("key") in names and isinstance(f.get("value"), (int, float))
                and not isinstance(f.get("value"), bool) and f.get("as_of")):
            if best is None or f["as_of"] > best["as_of"]:
                best = f
    return best


def cash_series():
    """현금 기록을 날짜순으로. 한 달에 하나만 적어도 흐름이 나온다."""
    facts = load("reality/facts.json")["facts"]
    by_date = {}
    for f in facts:
        if (f.get("key") in ("available_cash", "current_cash", "cash_history")
                and isinstance(f.get("value"), (int, float)) and not isinstance(f.get("value"), bool)
                and f.get("as_of")):
            by_date[f["as_of"]] = (f["as_of"], f["value"], f["id"])   # 같은 날은 뒤엣것이 이긴다
    return [by_date[d] for d in sorted(by_date)]


MIN_SPAN_DAYS = 20   # 사흘 간격으로 월 흐름을 내면 말이 안 된다. 실제로 그렇게 나왔었다.


def days_between(a, b):
    return (date.fromisoformat(b) - date.fromisoformat(a)).days


def cash_pair():
    """가장 최근 기록과, 거기서 충분히 떨어진 가장 가까운 이전 기록."""
    pts = cash_series()
    if len(pts) < 2:
        return None
    last = pts[-1]
    for p in reversed(pts[:-1]):
        if days_between(p[0], last[0]) >= MIN_SPAN_DAYS:
            return p, last
    return None


def derive():
    facts = load("reality/facts.json")["facts"]
    asm = {a["variable"]: a for a in load("sim/assumptions.json")["assumptions"]}
    have, why = {}, {}
    for name, keys in LOOKUP.items():
        hit = latest(facts, keys)
        if hit:
            have[name] = {"value": hit["value"], "as_of": hit["as_of"], "fact": hit["id"]}
        else:
            why[name] = "{} 기록이 없다. 입력함에 `{}` 을 적으면 채워진다.".format(name, HOWTO[name])
    v = {k: have[k]["value"] for k in have}
    out = {}

    def need(*keys):
        return all(k in v for k in keys)

    # 적자는 '유출 - 유입' 이다. 유입을 모를 때만 월급으로 대신하고, 어느 쪽을 썼는지 적는다.
    if need("spend", "inflow"):
        out["deficit"] = v["spend"] - v["inflow"]
        out["deficit_basis"] = "월 총유출 − 월 총유입 (둘 다 측정값)"
    elif need("spend", "income"):
        out["deficit"] = v["spend"] - v["income"]
        out["deficit_basis"] = "월 총유출 − 세후 월급 (**유입 기록이 없어 월급으로 대신했다**. 월급 외 유입이 있으면 적자가 과대평가된다)"
    else:
        why["deficit"] = "월 총유출이 있어야 적자를 낼 수 있다(유입 또는 월급과 함께)."
    if need("cash") and out.get("deficit", 0) > 0:
        out["runway_months_with_income"] = round(v["cash"] / out["deficit"], 1)
    if need("cash", "spend"):
        out["runway_months_no_inflow"] = round(v["cash"] / v["spend"], 1)
        out["one_month_gap_cost"] = v["spend"]
    # **가장 싼 길**: 현금 기록 두 개만 있으면 그 사이 순증감이 나온다.
    pair = cash_pair()
    if pair:
        (d0, c0, f0), (d1, c1, f1) = pair
        span = days_between(d0, d1) / 30.4
        out["net_from_cash"] = {
            "per_month": round((c1 - c0) / span),
            "from": {"date": d0, "cash": c0, "fact": f0},
            "to": {"date": d1, "cash": c1, "fact": f1},
            "span_months": round(span, 1),
            "note": "현금 잔액 두 개의 차이. 가계부를 옮겨 적지 않아도 나온다. "
                    "다만 **대출을 새로 받으면 현금이 늘어 적자가 가려진다** — 그래서 debt 도 가끔 적는다.",
        }
        why.pop("deficit", None)
    else:
        why["net_from_cash"] = (
            "{}일 이상 떨어진 현금 기록이 두 개 필요하다. **한 줄만 더 적으면** 흐름이 나온다 — "
            "`<날짜>  cash  <그날 잔액>`. **가계부는 옮겨 적지 않아도 된다.**".format(MIN_SPAN_DAYS))
    short = asm["stabilize_remaining_shortfall"]["value"]
    if need("income"):
        out["job_baseline_net_monthly"] = v["income"] + short
        if need("offer_net"):
            out["offer_gap"] = v["offer_net"] - out["job_baseline_net_monthly"]
        else:
            why["offer_gap"] = why.get("offer_net", "오퍼 세후 월급이 없다.")
    if need("income", "debt"):
        rng = asm["minimum_living_cost_1person"]["range"]
        months = asm["rehab_repayment_months"]["value"]
        band = []
        for cost in (rng["max"], rng["min"]):      # 최저생계비가 높을수록 가용소득이 작다
            free = v["income"] - cost
            if free <= 0:
                band.append({"min_living": cost, "free_income": free,
                             "note": "이 가정에서 잔여소득이 0 이하. 사건의 신청 가능성은 별도 상담이 필요하다."})
                continue
            total = free * months
            band.append({
                "min_living": cost, "free_income": free, "total_repaid": total,
                "forgiven": max(0, v["debt"] - total),
                "payment_delta": (free - v["debt_payment"]) if need("debt_payment") else None,
            })
        out["rehab_band"] = band
        out["rehab_note"] = "과거 생계비 가정의 산술 예시이며 사건의 예상 변제액·면책액이 아니다. 인정 생계비·청산가치·기간·비용 미확인. 상담·서류 준비 중(완료 미확인). execution/REHABILITATION_PREP_20261115.md 참조."
    if need("spend"):
        out["univ_fulltime_12m"] = v["spend"] * 12
    return {
        "as_of": datetime.now(KST).strftime("%Y-%m-%d"),
        "inputs": have, "derived": out, "unknown": why,
        "assumptions_used": sorted(asm[k]["id"] for k in asm),
        "contract": "simulated — reality/ 에 쓰지 않는다",
    }


def now_md(d):
    L = [
        "# 지금 — 기계가 쓴다",
        "",
        "작성: WACUS · 생성 {} · 엔진 `sim/run.py`".format(d["as_of"]),
        "",
        "> **이 파일은 손으로 고치지 않는다.** 커밋할 때마다 다시 쓰인다.",
        "> 바꾸려면 `input/inbox.tsv` 에 적는다. 엔진은 **판정하지 않고** 숫자와 모르는 이유만 낸다.",
        "",
        "## 받은 값",
        "",
        "| 항목 | 값 | 기준일 | 근거 |",
        "|---|---:|---|---|",
    ]
    for k, label in LABEL.items():
        if k in d["inputs"]:
            i = d["inputs"][k]
            L.append("| {} | {} | {} | {} |".format(label, won(i["value"]), i["as_of"], i["fact"]))
        else:
            L.append("| {} | **미확인** | — | — |".format(label))
    g = d["derived"]
    L += ["", "## 계산된 값", ""]
    if "deficit" in g:
        L.append("- **월 {} {}**".format("적자" if g["deficit"] > 0 else "흑자", won(abs(g["deficit"]))))
    if "runway_months_with_income" in g:
        L.append("- 현금이 버티는 기간 — 소득 유지 **{}개월**".format(g["runway_months_with_income"]))
    if "net_from_cash" in g:
        n = g["net_from_cash"]
        word = "줄었다" if n["per_month"] < 0 else "늘었다"
        L.append("- **현금 잔액으로 본 흐름 — 매달 {} {}** ({} {} → {} {}, {}개월)".format(
            won(abs(n["per_month"])), word, n["from"]["date"], won(n["from"]["cash"]),
            n["to"]["date"], won(n["to"]["cash"]), n["span_months"]))
        L.append("  - 이게 **가장 싼 숫자**다. 한 달에 한 줄이면 된다. " + n["note"].split("다만")[1].strip().join(["다만 ", ""]))
    if "deficit_basis" in g:
        L.append("  - 산식: {}".format(g["deficit_basis"]))
    if "runway_months_no_inflow" in g:
        L.append("- 현금이 버티는 기간 — **들어오는 돈이 전부 끊기면 {}개월**".format(g["runway_months_no_inflow"]))
    if "one_month_gap_cost" in g:
        L.append("- 공백 한 달의 값 **{}**".format(won(g["one_month_gap_cost"])))
    if "job_baseline_net_monthly" in g:
        L.append("- 이직으로 적자 0 을 만들려면 **세후 월 {}** 이상 (ASM-0102)".format(
            won(g["job_baseline_net_monthly"])))
    if "offer_gap" in g:
        gap = g["offer_gap"]
        tail = "" if gap >= 0 else " — 이직해도 다른 레버가 전부 필요하다"
        L.append("  - 받은 오퍼는 그 선보다 **{} {}**다{}".format(
            won(abs(gap)), "위" if gap >= 0 else "아래", tail))
    if "univ_fulltime_12m" in g:
        L.append("- 전업 1년의 **상한** {} (유출×12. 이체가 섞여 있어 실제로는 이보다 작다)".format(
            won(g["univ_fulltime_12m"])))
    if "rehab_band" in g:
        L += ["", "### 개인회생 (과거 가정의 산술 예시 · 사건 예상액 아님)", "",
              "| 생계비 가정 | 소득 차액 | 36개월 단순 합계 | 채무와 차액(면책 확정 아님) | 지금 납입 대비 |",
              "|---:|---:|---:|---:|---:|"]
        for b in g["rehab_band"]:
            if "total_repaid" not in b:
                L.append("| {} | {} | — | — | {} |".format(
                    won(b["min_living"]), won(b["free_income"]), b["note"]))
                continue
            dlt = b["payment_delta"]
            if dlt is None:
                delta_text = "미확인"
            else:
                delta_text = ("+" if dlt > 0 else "") + won(dlt)
            L.append("| {} | {} | {} | {} | {} |".format(
                won(b["min_living"]), won(b["free_income"]), won(b["total_repaid"]),
                won(b["forgiven"]), delta_text))
        L += ["", "> " + g["rehab_note"]]
    if d["unknown"]:
        L += ["", "## 아직 모르는 것 — 적으면 채워진다", "",
              "`input/inbox.tsv` 에 한 줄 적고 커밋하면 된다. **모르면 비워 둔다. 0 으로 적지 않는다.**", ""]
        for k, reason in d["unknown"].items():
            L.append("- **{}** — {}".format(LABEL.get(k, k), reason))
    L += ["", "---",
          "가정: {} (`sim/assumptions.json`)".format(" · ".join(d["assumptions_used"])),
          "파생값 원본: `simulation/_derived.json`", ""]
    return "\n".join(L)


def main():
    rows, errors = read_inbox()
    log = []
    if errors:
        log.append("입력 오류 — 그 줄만 건너뛴다:")
        log += ["  " + e for e in errors]
    added = apply_inbox(rows)
    if added:
        log.append("사실 {}건 반영: {}".format(len(added), ", ".join(added)))
    d = derive()
    save("simulation/_derived.json", d)
    write(ROOT / "state" / "NOW.md", now_md(d))
    fc = subprocess.run([sys.executable, str(ROOT / "sim" / "forecast.py")], capture_output=True,
                        text=True, encoding="utf-8", errors="replace", cwd=str(ROOT))
    log.append((fc.stdout or "").strip() or ("예측 실패: " + (fc.stderr or "").strip()[:200]))
    gen = ROOT / "tools" / "build_app_import.py"
    if gen.exists():
        r = subprocess.run([sys.executable, str(gen)], capture_output=True, text=True,
                           encoding="utf-8", errors="replace", cwd=str(ROOT))
        if r.returncode != 0:
            log.append("앱 데이터 생성 실패: " + (r.stderr or "").strip()[:300])
    log.append("모르는 값 {}개".format(len(d["unknown"])) if d["unknown"] else "모르는 값 없음")
    print("\n".join(log))
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
