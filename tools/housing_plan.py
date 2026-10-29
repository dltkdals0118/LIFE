"""목표가 '집을 사고 현금 1억'으로 정의된 뒤의 산술.

    python tools/housing_plan.py

사용자 확인(SRC-039, 2026-10-29):
  · 주거 — 신축 아파트, 서울 선호·수도권 가능, **7~11억**
  · '라이트하게' 전환 기준 — **집을 사고 현금 1억이 있을 때**
  · 주택담보대출 — **필요하면 쓴다**
  · 기한 — 10년 선호, **최대 15년**(B 레버 해금)

즉 10~15년 목표는 32억이 아니라 **자기자금 한 덩어리**다:
    자기자본(주택가 × 비율) + 현금 1억 + 기존 채무 청산 4,600만 + 취득 부대비용

**트레이드오프가 이 문서의 핵심이다.** 자기자본을 많이 넣으면 모으기 어렵고,
적게 넣으면 매입 뒤 월 상환이 커져 '라이트하게'가 막힌다.

이 스크립트는 **판단하지 않는다.** 금리·취득세율·LTV 는 전부 가정이며 공식 근거로
확인된 값이 아니다. 이 숫자로 실제 재무 결정을 하지 않는다.
"""
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

EOK = 100_000_000
MAN = 10_000

NET_WORTH_NOW = -20_000_000   # 현금600 + 보증금2,000 − 채무4,600 (FACT-0062·0071·0063)
DEBT_PAYOFF = 46_000_000      # FACT-0063
CASH_TARGET = 100_000_000     # Q-045 — '현금 1억'
INCOME_NOW = 2_850_000        # FACT-0060·0061
RENT_NOW = 950_000            # FACT-0070 현재 월 주거비

# --- 가정 (ASM). 전부 modeling 이며 공식 근거로 확인한 값이 아니다 ---------
ACQUISITION_COST_RATE = 0.04  # ASM-0008 취득세·중개·이사 등 부대비용. 실제 세율·감면 미확인
MORTGAGE_RATE = 0.04          # ASM-0009 주담대 금리. 미확인
MORTGAGE_YEARS = 30           # ASM-0010 상환 기간


def won(x):
    return f"{x / EOK:,.2f}억" if abs(x) >= EOK else f"{x / MAN:,.0f}만"


def pmt_for_target(target, annual_rate, years, present=0.0):
    n = years * 12
    if annual_rate == 0:
        return (target - present) / n
    r = annual_rate / 12
    return (target - present * (1 + r) ** n) * r / ((1 + r) ** n - 1)


def mortgage_payment(principal, annual_rate=MORTGAGE_RATE, years=MORTGAGE_YEARS):
    if principal <= 0:
        return 0.0
    r = annual_rate / 12
    n = years * 12
    return principal * r / (1 - (1 + r) ** -n)


def needed_own_funds(price, equity_ratio):
    """매입 시점에 손에 있어야 하는 자기자금."""
    equity = price * equity_ratio
    fees = price * ACQUISITION_COST_RATE
    return equity + fees + CASH_TARGET + DEBT_PAYOFF


def main():
    print("=== 목표 재정의 — '집을 사고 현금 1억' ===")
    print(f"    필요 자기자금 = 자기자본 + 부대비용({ACQUISITION_COST_RATE:.0%}) "
          f"+ 현금 {won(CASH_TARGET)} + 채무청산 {won(DEBT_PAYOFF)}")
    print(f"    출발점: 순자산 {won(NET_WORTH_NOW)} (보증금 2,000만은 매입 시 자기자본으로 전환)")
    print()

    for price in (7 * EOK, 9 * EOK, 11 * EOK):
        print(f"--- 주택가 {won(price)} ---")
        print("   자기자본  필요자기자금 | 10년 월적립(0%/5%) | 15년 월적립(0%/5%) | 매입후 월상환")
        for ratio in (0.3, 0.4, 0.5, 0.7, 1.0):
            need = needed_own_funds(price, ratio)
            loan = price * (1 - ratio)
            m10_0 = pmt_for_target(need, 0.0, 10, NET_WORTH_NOW)
            m10_5 = pmt_for_target(need, 0.05, 10, NET_WORTH_NOW)
            m15_0 = pmt_for_target(need, 0.0, 15, NET_WORTH_NOW)
            m15_5 = pmt_for_target(need, 0.05, 15, NET_WORTH_NOW)
            pay = mortgage_payment(loan)
            print(f"    {ratio:>6.0%}  {won(need):>11} | {won(m10_0):>8} {won(m10_5):>8} "
                  f"| {won(m15_0):>8} {won(m15_5):>8} | {won(pay):>8}")
        print()

    print("=== 매입 뒤 월 고정비는 어떻게 바뀌나 ===")
    print(f"    지금 주거비 {won(RENT_NOW)} 이 사라지고 대출 상환이 생긴다.")
    print(f"    (금리 {MORTGAGE_RATE:.0%}·{MORTGAGE_YEARS}년 가정 — **미확인 값이다**)")
    print("    주택가   자기자본 50%        자기자본 70%")
    for price in (7 * EOK, 9 * EOK, 11 * EOK):
        row = f"    {won(price):>6} "
        for ratio in (0.5, 0.7):
            pay = mortgage_payment(price * (1 - ratio))
            delta = pay - RENT_NOW
            sign = "+" if delta > 0 else ""
            row += f"  월 {won(pay):>7} ({sign}{won(delta)})"
        print(row)
    print()
    print("    -> 자기자본을 적게 넣을수록 모으기는 쉽지만 매입 뒤 월 부담이 커진다.")
    print("    -> '라이트하게 일한다'는 **매입 뒤**의 상태이므로, 그때 상환을 감당할 수 있어야 한다.")
    print("       이것이 자기자본 비율을 정하는 실제 기준이다.")
    print()

    print("=== 지금 상태에서 월 얼마를 모을 수 있나 ===")
    print(f"    월수입 {won(INCOME_NOW)} · 현재 월 적자 261만(FACT-0117)")
    print("    적자를 0으로 만든 뒤 남는 돈이 곧 적립액이다.")
    for cut in (0, 1_000_000, 1_810_000, 2_610_000):
        save = cut - 2_610_000
        label = "적자 그대로" if cut == 0 else f"지출 {won(cut)} 절감"
        state = f"월 {won(save)}" if save < 0 else f"월 {won(save)} 저축"
        print(f"    {label:<18} -> {state}")
    print("    -> 지출만으로는 흑자 전환이 끝이다. 적립은 **소득이 올라야** 시작된다.")
    print()

    print("=== 그래서 월수입이 얼마여야 하나 ===")
    print("    적자를 0으로 만들면 지출 = 수입 = 285만. 거기서 월 X 를 적립하려면 수입은 285만 + X.")
    print("    (연 5% 가정)")
    print("    주택가 자기자본 | 기한 | 필요 월적립 | 필요 월수입 | 현재(285만) 대비")
    for price, ratio in ((7 * EOK, 0.3), (7 * EOK, 0.5), (9 * EOK, 0.4),
                         (9 * EOK, 0.5), (11 * EOK, 0.4), (11 * EOK, 0.5)):
        need = needed_own_funds(price, ratio)
        for years in (10, 15):
            save = pmt_for_target(need, 0.05, years, NET_WORTH_NOW)
            income = INCOME_NOW + save
            print(f"    {won(price):>6} {ratio:>6.0%} | {years:>2}년 | {won(save):>9} "
                  f"| {won(income):>9} | {income / INCOME_NOW:>5.1f}배")
    print()
    print("    -> 32억 경로는 지금의 10~15배였다. 이 경로는 **1.5~2.8배**다.")
    print("       마케팅 경력으로 10~15년 안에 닿지 못할 배수가 아니다.")
    print("       다만 이것은 산술일 뿐, 실제 가능 여부는 Q-007(직접 수행 역량)과 함께 봐야 한다.")
    print()
    print("이 출력은 산술이고 조언이 아니다. 금리·취득세율·수익률은 확인된 값이 아닌 가정이다.")


if __name__ == "__main__":
    main()
