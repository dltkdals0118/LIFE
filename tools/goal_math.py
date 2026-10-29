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
    print("\n이 출력은 산술이고 조언이 아니다. 수익률·인출률은 검증된 값이 아닌 가정이다.")


if __name__ == "__main__":
    main()
