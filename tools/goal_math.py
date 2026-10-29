"""목표 금액·기한·저축액 사이의 산술. 재현 가능하게 한곳에 둔다.

    python tools/goal_math.py

이 스크립트는 **판단하지 않는다.** 산술만 한다.
수익률과 인출률은 `--rate` / `--swr` 로 바꿀 수 있고, 기본값은 가정(ASM)이지 사실이 아니다.
`reality/GOALS.md` 의 ASM-0001 과 같은 취급을 받는다 — 이 숫자로 실제 재무 결정을 하지 않는다.

출처가 되는 값은 전부 facts.json 에서 온다:
  순자산 -2,000만(FACT-0062·0071·0063) · 수입 280~290만(FACT-0060·0061)
  적자 월 261만(FACT-0117) · 실지출 394~549만(FACT-0116) · 고정비 229만(FACT-0087)
  목표 32억(FACT-0121) · 기한 10년(SRC-037)
"""
import argparse
import sys

# 윈도우 콘솔은 기본이 cp949 라 em-dash 하나에 스크립트가 죽는다.
# 호출하는 쪽에 인코딩 환경변수를 붙이게 하지 않고 여기서 해결한다.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

MAN = 10_000           # 만원
EOK = 100_000_000      # 억원

NET_WORTH_NOW = -20_000_000
TARGET = 3_200_000_000
YEARS = 10
INCOME_LOW, INCOME_HIGH = 2_800_000, 2_900_000
DEFICIT_NOW = 2_610_000
SPEND_LOW, SPEND_HIGH = 3_943_683, 5_490_562   # 월 실지출 실측 (9월 / 10월)
FIXED_ONLY = 2_290_000                          # 확인된 고정비


def fv_of_annuity(pmt, annual_rate, years):
    """매월 pmt 를 years 년간 넣었을 때의 미래가치."""
    n = years * 12
    if annual_rate == 0:
        return pmt * n
    r = annual_rate / 12
    return pmt * ((1 + r) ** n - 1) / r


def pmt_for_target(target, annual_rate, years, present=0.0):
    """years 년 뒤 target 을 만들려면 매월 얼마가 필요한가."""
    n = years * 12
    if annual_rate == 0:
        return (target - present) / n
    r = annual_rate / 12
    fv_present = present * (1 + r) ** n
    return (target - fv_present) * r / ((1 + r) ** n - 1)


def won(x):
    if abs(x) >= EOK:
        return f"{x / EOK:,.2f}억"
    return f"{x / MAN:,.0f}만"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rate", type=float, default=None,
                    help="연 수익률. 생략하면 0%%/5%%/7%% 세 가지를 모두 낸다")
    ap.add_argument("--swr", type=float, default=0.04, help="안전 인출률 (ASM-0001)")
    ap.add_argument("--years", type=int, default=YEARS)
    args = ap.parse_args()
    rates = [args.rate] if args.rate is not None else [0.0, 0.05, 0.07]

    print(f"=== 1. {args.years}년 뒤 {won(TARGET)}을 만들려면 매월 얼마가 필요한가 ===")
    print(f"    현재 순자산 {won(NET_WORTH_NOW)} 에서 시작")
    for r in rates:
        need = pmt_for_target(TARGET, r, args.years, NET_WORTH_NOW)
        ratio = need / ((INCOME_LOW + INCOME_HIGH) / 2)
        tag = "가정 없음" if r == 0 else f"ASM 연 {r:.0%}"
        print(f"    연 {r:>4.0%} ({tag:>10}) → 월 {won(need):>8}   = 현재 월수입의 {ratio:,.1f}배")

    print(f"\n=== 2. 현재 수입(월 {won(INCOME_LOW)}~{won(INCOME_HIGH)})으로 가능한 {args.years}년 뒤 순자산 ===")
    print("    (적자를 0으로 만든 뒤 남는 돈을 전액 저축한다고 가정)")
    for save in (0, 500_000, 1_000_000, 1_500_000, 2_000_000):
        line = f"    월 {won(save):>6} 저축 →"
        for r in rates:
            fv = fv_of_annuity(save, r, args.years) + NET_WORTH_NOW
            line += f"  연{r:.0%}: {won(fv):>8}"
        pct = (fv_of_annuity(save, 0.07, args.years) + NET_WORTH_NOW) / TARGET * 100
        print(line + f"   (연7% 기준 목표의 {pct:,.1f}%)")

    print(f"\n=== 3. 지금 그대로 가면 ({args.years}년) ===")
    fv = NET_WORTH_NOW - DEFICIT_NOW * args.years * 12
    print(f"    월 적자 {won(DEFICIT_NOW)} 유지 → 순자산 {won(fv)}")
    print(f"    ※ 현금 600만은 약 {6_000_000 / DEFICIT_NOW:.1f}개월에 바닥난다. "
          f"이 경로는 {args.years}년짜리가 아니라 두어 달짜리다.")

    print(f"\n=== 4. '일을 안 해도 되는 돈'은 얼마인가 (ASM 인출률 {args.swr:.0%}) ===")
    for label, spend in (("지금 생활 그대로 (9월 실측)", SPEND_LOW),
                         ("지금 생활 그대로 (10월 실측)", SPEND_HIGH),
                         ("식음료를 월 100만으로 낮춘 경우", FIXED_ONLY + 1_000_000),
                         ("확인된 고정비만", FIXED_ONLY)):
        need = spend * 12 / args.swr
        print(f"    {label:<28} 월 {won(spend):>6} → {won(need):>8}  "
              f"(목표 {won(TARGET)}의 {need / TARGET * 100:,.0f}%)")

    print(f"\n=== 5. 적자를 0으로 만드는 데 필요한 금액 ===")
    print(f"    월 {won(DEFICIT_NOW)}. 식음료(월 182~281만)가 가장 큰 재량 자리다(FACT-0124).")
    print(f"    10월 281만 → 100만으로 낮추면 월 181만이 생기고, 적자의 "
          f"{1_810_000 / DEFICIT_NOW * 100:.0f}%가 덮인다.")
    print()
    report_bottom_up(args.swr)
    report_food_leverage(args.swr)
    report_income_needed()
    print("\n이 출력은 산술이고 조언이 아니다. 수익률·인출률은 검증된 값이 아닌 가정이다.")


# ---------------------------------------------------------------------------
# 아래에서 위로 — 목표 금액을 쌓아 올린다 (2026-10-29 추가)
#
# 사용자 확인(SRC-038): 32억에 **주거 매입은 포함**, 결혼·자녀·부모 부양·노후는 미포함.
# '라이트하게·워라밸'은 **제약이 아니라 결과**다 — 경제적으로 좋아진 뒤의 상태이고
# 그 전까지는 라이트하게 살 생각이 없다. 기한 10년은 **연장 불가**.
# ---------------------------------------------------------------------------

FIXED_AFTER = 540_000   # 부채0·주거매입 후 월 고정비: 어머니30+보험10+통신7+교통7
DEBT_PAYOFF = 46_000_000
EMERGENCY_MONTHS = 12


def bottom_up(housing, food, light_income, swr=0.04):
    """주거 매입가·식음료·라이트 근로소득을 넣으면 필요 총자산이 나온다."""
    living = FIXED_AFTER + food
    financial = max(0, living - light_income) * 12 / swr
    return housing + DEBT_PAYOFF + living * EMERGENCY_MONTHS + financial


def report_bottom_up(swr):
    print("=== 6. 아래에서 위로 — 목표 금액을 쌓는다 ===")
    print("    부채청산 4,600만 + 비상금(12개월) + 금융자산(4% 인출) + 주거 매입가")
    print("    [주의] 주거를 전액 현금으로 산다고 가정했다. 주택담보대출을 쓰면 필요 자기자본은")
    print("           크게 준다 — LTV/DSR 규제와 금리는 미확인이라 넣지 않았다.")
    print()
    print("     주거 | 식음료 월100만            | 식음료 월280만(현 수준)")
    print("          | 라이트근로150만    근로0  | 라이트근로150만    근로0")
    for H in (5, 8, 10, 12, 15, 20, 25):
        c = [won(bottom_up(H * EOK, food, inc, swr))
             for food in (1_000_000, 2_800_000) for inc in (1_500_000, 0)]
        print(f"    {H:>3}억 | {c[0]:>13} {c[1]:>9} | {c[2]:>13} {c[3]:>9}")
    print()
    print("    -> 주거 매입가가 목표 금액의 대부분을 정한다.")
    print("    -> 32억이 되려면 주거가 21~26억이어야 한다.")


def report_food_leverage(swr):
    print()
    print("=== 7. 식음료비가 목표 금액을 얼마나 움직이나 (라이트 근로 월150만 가정) ===")
    base = None
    for food in (1_000_000, 1_500_000, 2_000_000, 2_800_000):
        need = max(0, FIXED_AFTER + food - 1_500_000) * 12 / swr
        base = need if base is None else base
        print(f"    식음료 월 {won(food):>6} -> 필요 금융자산 {won(need):>8}"
              f"   (월100만 대비 +{won(need - base)})")
    print("    -> 월 180만의 식음료 차이가 필요 자산 5.4억을 만든다. 인출률 4%의 25배 효과다.")
    print("    -> 지출을 줄이는 것은 적자만 메우는 게 아니라 목표 금액 자체를 낮춘다.")


def report_income_needed():
    print()
    print("=== 8. 목표액별로 월수입이 얼마여야 하나 (C: 소득 구조 변경, 연5% 가정) ===")
    print("      목표   필요 월적립   저축률50%면   저축률70%면")
    for t in (5, 8, 10, 12, 15, 20, 32):
        need = pmt_for_target(t * EOK, 0.05, 10, NET_WORTH_NOW)
        print(f"    {t:>4}억 {won(need):>12} {won(need * 2):>13} {won(need / 0.7):>13}")
    print("    [주의] 현재 월수입 285만. 저축률 70%는 생활비를 수입의 30%로 누른다는 뜻이다.")


if __name__ == "__main__":
    main()
