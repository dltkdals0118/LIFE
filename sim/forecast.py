"""몇 달 뒤까지 굴려 보고, 경우의 수를 보여주고, 지난 예측이 맞았는지 채점한다. 작성: WACUS

학습형이라는 말의 뜻은 하나다: **예측을 적어 두고, 실제가 들어오면 맞았는지 센다.**
적어 두지 않으면 매번 새로 지어낼 뿐이고 아무것도 배우지 못한다.

엔진은 판정하지 않는다. 좋다·나쁘다를 적지 않고 숫자와 '무엇이 참이어야 하는가'만 낸다.
레버 값은 전부 **가정**이다 — 사실과 섞이지 않게 simulation/ 안에만 둔다.
"""
import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KST = timezone(timedelta(hours=9))


def won(n):
    return "{:,}원".format(int(round(n)))


def load(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def write(path, text):
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    if path.exists() and path.read_text(encoding="utf-8").replace("\r\n", "\n") == text:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")
    return True


def month_add(ym, k):
    y, m = int(ym[:4]), int(ym[5:7])
    t = (y * 12 + m - 1) + k
    return "{:04d}-{:02d}".format(t // 12, t % 12 + 1)


def project(start_ym, months, cash, net_monthly, picks, levers):
    """달마다 현금을 굴린다. 레버는 시작 달부터 적용한다."""
    rows, c = [], cash
    for i in range(months):
        ym = month_add(start_ym, i)
        gain = 0
        for lv in levers:
            opt = next((o for o in lv["options"] if o["key"] == picks.get(lv["id"])), None)
            if opt and ym >= lv["starts"]:
                gain += opt["delta"]
        flow = net_monthly + gain
        c += flow
        rows.append({"month": ym, "flow": flow, "cash": c, "lever_gain": gain})
    return rows


def requirements(picks, levers):
    """이 경로가 성립하려면 참이어야 하는 것들. 레버 순서를 유지한다."""
    out = []
    for lv in levers:
        opt = next((o for o in lv["options"] if o["key"] == picks.get(lv["id"])), None)
        if opt and opt.get("requires"):
            out.append({"lever": lv["name"], "option": opt["label"], "requires": opt["requires"]})
    return out


def score_past(actual_cash_by_month):
    """지난 예측을 실제와 대본다. 맞히려는 게 아니라 **가정이 어디서 틀렸는지** 보려는 것이다."""
    path = ROOT / "simulation" / "_predictions.jsonl"
    if not path.exists():
        return []
    scored = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        p = json.loads(line)
        act = actual_cash_by_month.get(p["month"])
        if act is None:
            continue
        scored.append({
            "made_on": p["made_on"], "month": p["month"], "path": p["path"],
            "predicted": p["cash"], "actual": act, "error": act - p["cash"],
        })
    return scored


def record(predictions):
    """이번 예측을 남긴다. 같은 (만든날·달·경로)은 한 번만."""
    path = ROOT / "simulation" / "_predictions.jsonl"
    seen = set()
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                p = json.loads(line)
                seen.add((p["made_on"], p["month"], p["path"]))
    fresh = [p for p in predictions if (p["made_on"], p["month"], p["path"]) not in seen]
    if not fresh:
        return 0
    body = "".join(json.dumps(p, ensure_ascii=False) + "\n" for p in fresh)
    with path.open("a", encoding="utf-8", newline="\n") as fh:
        fh.write(body)
    return len(fresh)


def actual_cash_by_month():
    """월별 '그 달의 마지막 현금 기록'. 없는 달은 넣지 않는다 — 비는 것이 맞다."""
    facts = load("reality/facts.json")["facts"]
    out = {}
    for f in facts:
        if f.get("key") in ("available_cash", "current_cash", "cash_history") and isinstance(f.get("value"), (int, float)):
            ym = (f.get("as_of") or "")[:7]
            if len(ym) == 7:
                prev = out.get(ym)
                if prev is None or f["as_of"] >= prev[0]:
                    out[ym] = (f["as_of"], f["value"])
    return {k: v[1] for k, v in out.items()}


def build():
    d = load("simulation/_derived.json")
    sc = load("sim/scenarios.json")
    inp, der = d["inputs"], d["derived"]
    if "cash" not in inp:
        return None, "현금 기록이 없다 — input/inbox.tsv 에 `<날짜>  cash  <잔액>` 한 줄이면 돈다."

    cash = inp["cash"]["value"]
    # **현금 잔액 두 개의 차이를 1순위로 쓴다.** 가계부를 옮겨 적지 않아도 예측이 돈다.
    nfc = der.get("net_from_cash")
    if nfc and nfc.get("span_months", 0) >= 0.5:
        net = nfc["per_month"]
        basis = "현금 잔액 두 개의 차이 ({} → {}, {}개월). **가계부를 옮겨 적지 않았다.**".format(
            nfc["from"]["date"], nfc["to"]["date"], nfc["span_months"])
    elif "spend" in inp and "inflow" in inp:
        net = inp["inflow"]["value"] - inp["spend"]["value"]
        basis = "월 유출·유입 실측 ({}).".format(inp["spend"]["as_of"])
    else:
        return None, ("흐름을 낼 수 없다. **현금 잔액을 한 줄 더 적으면** 그 사이 흐름으로 돈다 — "
                      "`<날짜>  cash  <그날 잔액>`.")
    today = datetime.now(KST)
    start = month_add("{:04d}-{:02d}".format(today.year, today.month), 1)
    months = sc["horizon_months"]
    levers = sc["levers"]
    promo_starts = next((l["starts"] for l in levers if l["id"] == "promo"), start)

    paths = []
    for p in sc["paths"]:
        rows = project(start, months, cash, net, p["picks"], levers)
        paths.append({
            "key": p["key"], "label": p["label"], "picks": p["picks"], "rows": rows,
            "end_cash": rows[-1]["cash"],
            "zero_month": next((r["month"] for r in rows if r["cash"] < 0), None),
            "end_flow": rows[-1]["flow"],
            "requires": requirements(p["picks"], levers),
        })

    # 레버 하나만 최선으로 바꿨을 때 — 어느 손잡이가 제일 크냐
    def neutral(lv):
        z = [o for o in lv["options"] if o["delta"] == 0]
        return (z[0] if z else min(lv["options"], key=lambda o: abs(o["delta"])))["key"]

    base = {lv["id"]: neutral(lv) for lv in levers}
    base_end = project(start, months, cash, net, base, levers)[-1]["cash"]
    sens = []
    for lv in levers:
        best = max(lv["options"], key=lambda o: o["delta"])
        picks = dict(base)
        picks[lv["id"]] = best["key"]
        end = project(start, months, cash, net, picks, levers)[-1]["cash"]
        sens.append({"lever": lv["name"], "option": best["label"],
                     "monthly": best["delta"], "gain_over_horizon": end - base_end,
                     "starts": lv["starts"], "requires": best.get("requires", [])})
    sens.sort(key=lambda x: -x["gain_over_horizon"])

    # 승진 후 월급은 미정이고(FACT-0210) 정하는 자리에 본인이 있다.
    # 그래서 '얼마가 될까' 를 추정하지 않고 '얼마여야 하나' 를 역산한다.
    def gain_of(picks, ym):
        g = 0
        for lv in levers:
            o = next((x for x in lv["options"] if x["key"] == picks.get(lv["id"])), None)
            if o and ym >= lv["starts"]:
                g += o["delta"]
        return g

    last = month_add(start, months - 1)
    targets = []
    for p in sc["paths"]:
        rows = project(start, months, cash, net, p["picks"], levers)
        monthly_need = max(0, -(net + gain_of(p["picks"], last)))     # 마지막 달 수지를 0 으로
        end = rows[-1]["cash"]
        # 지평 끝에 현금을 0 이상으로 두려면: 부족분을 '승진이 듣기 시작하는 달부터 남은 달 수' 로 나눈다
        eff = sum(1 for i in range(months) if month_add(start, i) >= promo_starts)
        horizon_need = max(0, int(round(-end / eff))) if end < 0 and eff else 0
        targets.append({"path": p["key"], "label": p["label"],
                        "monthly_need": monthly_need, "horizon_need": horizon_need,
                        "effective_months": eff})

    made_on = today.strftime("%Y-%m-%d")
    preds = [{"made_on": made_on, "month": r["month"], "path": p["key"], "cash": r["cash"]}
             for p in paths for r in p["rows"]]
    added = record(preds)
    scored = score_past(actual_cash_by_month())

    return {
        "made_on": made_on, "start": start, "months": months,
        "cash_now": cash, "net_monthly": net,
        "cash_as_of": inp["cash"]["as_of"], "flow_basis": basis,
        "paths": paths, "sensitivity": sens, "base_end": base_end,
        "scored": scored, "predictions_added": added, "targets": targets,
        "promo_starts": promo_starts, "income_now": d["inputs"].get("income", {}).get("value"),
        "promo_note": sc.get("_promo_note", ""),
        "overlap_note": sc["_overlap"],
    }, None


def render(f):
    last_month = f["paths"][0]["rows"][-1]["month"]
    L = [
        "# 앞으로 {}달 — 경우의 수".format(f["months"]),
        "",
        "작성: WACUS · 생성 {} · 엔진 `sim/forecast.py`".format(f["made_on"]),
        "",
        "> **이 파일은 손으로 고치지 않는다.** 커밋할 때마다 다시 쓰인다.",
        "> 숫자는 전부 **가정 위의 계산**이다. 레버 값은 `sim/scenarios.json` 에 근거와 함께 있다.",
        "> 엔진은 **어느 경로가 옳은지 고르지 않는다.** 무엇이 참이어야 그 경로가 성립하는지만 적는다.",
        "",
        "## 출발점",
        "",
        "| | |",
        "|---|---:|",
        "| 지금 현금 ({}) | {} |".format(f["cash_as_of"], won(f["cash_now"])),
        "| 손대지 않았을 때 매달 | {} |".format(won(f["net_monthly"])),
        "",
        "흐름의 근거: {}".format(f["flow_basis"]),
        "",
        "## 경로별 — {} 부터 {}달".format(f["start"], f["months"]),
        "",
        "| 경로 | {} 현금 | 현금이 0 아래로 | 마지막 달 수지 |".format(f["paths"][0]["rows"][-1]["month"]),
        "|---|---:|---|---:|",
    ]
    for p in f["paths"]:
        zero = p["zero_month"] if p["zero_month"] else "안 간다"
        L.append("| **{}** | {} | {} | {} |".format(p["label"], won(p["end_cash"]), zero, won(p["end_flow"])))
    L += ["", "> 겹침 처리: {}".format(f["overlap_note"]), ""]

    for p in f["paths"]:
        L += ["### {} — 달마다".format(p["label"]), "",
              "| 달 | 레버로 더해지는 몫 | 그 달 수지 | 남는 현금 |", "|---|---:|---:|---:|"]
        for r in p["rows"]:
            L.append("| {} | {} | {} | {} |".format(
                r["month"], won(r["lever_gain"]), won(r["flow"]), won(r["cash"])))
        if p["requires"]:
            L += ["", "**이 경로가 성립하려면 — 준비할 것**", ""]
            for req in p["requires"]:
                L.append("- **{}** ({})".format(req["lever"], req["option"]))
                for one in req["requires"]:
                    L.append("  - [ ] {}".format(one))
        else:
            L += ["", "준비할 것이 없다 — 아무것도 바꾸지 않는 경로다.", ""]
        L.append("")

    L += ["## 무엇을 바꾸면 가장 크게 달라지나", "",
          "아무것도 안 바꾼 상태({})에서 **하나만** 최선으로 돌렸을 때 {}달 뒤 현금이 얼마나 달라지나.".format(
              won(f["base_end"]), f["months"]),
          "", "| 항목 | 최선 | 월 | {}달 누적 | 언제부터 |".format(f["months"]), "|---|---|---:|---:|---|"]
    for s in f["sensitivity"]:
        L.append("| {} | {} | {} | {} | {} |".format(
            s["lever"], s["option"], won(s["monthly"]), won(s["gain_over_horizon"]), s["starts"]))
    L += ["", "> 위에 있을수록 같은 노력으로 더 많이 바뀐다. **시작 달이 늦은 것은 누적이 작게 나온다** — 작아서가 아니라 늦어서다.",
          "> 이 표는 **돈만** 센다. 시간이 움직이는 항목(포커·수면·공부·운동)은 앱 화면에서 본다.", ""]

    L += ["## 협상 목표 — 모르는 값이 아니라 정하러 가는 값이다", "",
          "승진 후 월급은 **아직 미정**이다(FACT-0210 · 연봉협상·계약서 전).",
          "**그래서 추정하지 않았다 — 위 경로들은 전부 승진 인상분을 0 으로 둔다.**",
          "대신 역산한다: 저 경로를 가면서 **세후 월급이 얼마나 더 올라야** 수지가 맞나.", "",
          "| 경로 | 매달 수지를 0 으로 | {} 현금을 0 이상으로 |".format(last_month),
          "|---|---:|---:|"]
    for t in f["targets"]:
        L.append("| {} | **+{}** | **+{}** |".format(
            t["label"], won(t["monthly_need"]), won(t["horizon_need"])))
    if f.get("income_now"):
        best_t = next((t for t in f["targets"] if t["path"] == "best"), f["targets"][0])
        L += ["",
              "- 지금 세후 **{}**. 최선 경로를 가며 매달 수지를 0 으로 만들려면 **세후 월 {}** 이다.".format(
                  won(f["income_now"]), won(f["income_now"] + best_t["monthly_need"])),
              "- 아무것도 안 하는 경로에서 같은 것을 하려면 **세후 월 {}**.".format(
                  won(f["income_now"] + next(t["monthly_need"] for t in f["targets"] if t["path"] == "worst"))),
              "- 인상은 **{} 부터** 듣는 것으로 뒀다. 그 전 달들은 지금 수지 그대로다.".format(f["promo_starts"]),
              ""]
    L += ["> **이 숫자는 '받을 것 같은 금액' 이 아니라 '맞추려면 필요한 금액' 이다.**",
          "> 회사가 그만큼 줄지는 다른 문제이고, 모자란 만큼은 다른 손잡이로 메우거나 적자로 남는다.",
          "> 협상에서 쓸 근거는 경로별 체크박스에 있다 — DX 1차 결과, 지각 0, 자동화 구축 경력.", "",
          "## 이 예측이 흔들리는 지점 — 먼저 읽는다", "",
          "**한 달 실측으로 여섯 달을 굴리고 있다.** 그 한 달이 10월인데, 10월은 앞 두 달보다 나빴다:", "",
          "| 월 | 총지출 | 실지출(이체 제외) |", "|---|---:|---:|",
          "| 2026-08 | 5,859,531원 | 4,055,737원 |",
          "| 2026-09 | 6,159,453원 | 3,943,683원 |",
          "| **2026-10** | **8,268,480원** | **6,802,360원** |",
          "",
          "→ **10월을 그대로 굴리면 비관 쪽으로 치우친다.** 8·9월 수준이면 매달 약 200만이 덜 나간다.",
          "   반대로 10월이 새 기준이면 지금 표가 맞다. **어느 쪽인지는 11월 실측이 나와야 안다.**",
          "   `spend`·`inflow` 를 달마다 적으면 엔진이 최신 달로 굴린다.", "",
          "그 밖에 미확인인 것:", "",
          "- **승진 후 세후 월급** — `promo` 레버의 +30/+50만은 **추정**이다(FACT-0208).",
          "- 레버가 **언제부터** 실제로 듣는지 — 표는 시작 달부터 100% 듣는다고 본다. 실제로는 서서히 듣는다.",
          "- 한 번도 쓰지 않은 돈(경조사·의료·수리)은 들어 있지 않다.", "",
          "## 지난 예측은 맞았나", ""]
    if f["scored"]:
        L += ["| 예측한 날 | 대상 달 | 경로 | 예측 | 실제 | 차이 |", "|---|---|---|---:|---:|---:|"]
        for s in f["scored"]:
            sign = "+" if s["error"] >= 0 else ""
            L.append("| {} | {} | {} | {} | {} | {}{} |".format(
                s["made_on"], s["month"], s["path"], won(s["predicted"]), won(s["actual"]), sign, won(s["error"])))
        L += ["", "> 차이가 **+** 면 실제가 예측보다 나았다는 뜻이다. 맞히는 것이 목적이 아니라",
              "> **어느 가정이 틀렸는지** 보려는 것이다. 같은 방향으로 계속 틀리면 `sim/scenarios.json` 을 고친다.", ""]
    else:
        L += ["아직 댈 것이 없다. **예측 {}건을 적어 뒀다**(`simulation/_predictions.jsonl`).".format(
            f["predictions_added"]),
            "현금 기록이 그 달에 들어오면 여기서 자동으로 대 본다 — 그게 이 시뮬레이션이 '학습형'인 이유다.",
            "", "입력함에 이렇게 적으면 된다:", "", "```", "2026-12-01\tcash\t<그날 가용 현금>\t월초 확인", "```", ""]

    L += ["---",
          "레버와 가정: `sim/scenarios.json` · 예측 이력: `simulation/_predictions.jsonl`",
          "지금 값: `state/NOW.md`", ""]
    return "\n".join(L)


def main():
    f, err = build()
    if err:
        print("forecast: " + err)
        return 0
    write(ROOT / "simulation" / "_forecast.json", json.dumps(f, ensure_ascii=False, indent=2) + "\n")
    write(ROOT / "simulation" / "FORECAST.md", render(f))
    best = next((p for p in f["paths"] if p["key"] == "best"), f["paths"][0])
    worst = next((p for p in f["paths"] if p["key"] == "worst"), f["paths"][-1])
    print("예측 {}달: 최선 {} / 아무것도 안 하면 {}{}".format(
        f["months"], won(best["end_cash"]), won(worst["end_cash"]),
        " · 새 예측 {}건".format(f["predictions_added"]) if f["predictions_added"] else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
