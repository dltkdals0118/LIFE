# 포커 활동 원장 계약 제안 v0.1 — 미구현

## 범위
실제 포커 계정, 플랫폼 간 이동, 토너먼트 실제 비용, 시간·수면 영향을 추적한다. 현실 데이터를 시뮬레이션에서 복제할 수는 있어도 시뮬레이션 결과가 현실 기록을 자동 갱신하지 못한다.
수익 증대를 전제하거나 손실 회복을 유도하지 않는다.

## 레코드 최소 요건
- `poker_event`: event_id, platform_alias, poker_variant, tournament_id, entry_instance_id, entry_date_kst, stake_currency, buyin_amount, fee_amount, reentry_amount, rebuy_amount, add_on_amount, bounty_received, prize_received, reward_received, settlement_status, source_ids, reviewed_at.
- `poker_transfer`: transfer_id, account_alias_from, account_alias_to, amount, currency, date_kst, posted_status, exchange_rate_krw_if_known, source_ids. 플랫폼 출입금은 비용과 수익이 아니라 **계정 간 이전**.
- `poker_session`: session_id, start_at_kst, end_at_kst, play_minutes, review_minutes, fatigue_self_report_optional, disrupted_sleep_optional, stake_exposure, source_ids. 동시 멀티테이블은 실제 경과시간을 한 번만 계상.
- `poker_snapshot`: observed_at, platform_balance, locked_balance, bonus_balance, pending_withdrawals, account_currency, source_ids. 알 수 없으면 null.

## 계산 규칙 (단위 일치 필수)
1. 실제 포커 플레이 손익 = 정산된 상금 + 바운티 + 관련 리워드 - 바이인 - 참가 수수료 - 재참가/리바이/애드온 - 기타 관련 비용. 단, 게임별 수수료에 바이인 일부가 이미 포함되면 이중 차감하지 않는다.
2. 개인 자금 기준 포커 순이체 = 플랫폼 입금 - 플랫폼 출금. **실제 손익과 다르다**.
3. 플랫폼 잔액 변화 = 입금 - 출금 + 정산된 플레이 손익 + 기타 조정(환전·보너스·미결제·수수료 등). 내역이 없으면 차이를 설명 불가로 남긴다.
4. ROI = (정산된 순수익 / 총 확정 바이인 관련 원가) ×100. 총 원가 미확보 시 `null`.
5. 다중 통화는 원본 단위로 보존하고, 환산 시 적용일·환율을 별도 출처로 기록. ₮ UI와 USDT를 근거 없이 같은 통화/잔액으로 합치지 않는다.
6. 토너먼트 ID 중복은 같은 토너먼트를 여러 핸드에서 본 것일 수 있다. 공식 Played, ID 개수, re-entry 건수, 상금지급 횟수를 각각 독립 계산한다.
7. 게임상 칩 획득은 실제 상금으로 기록하지 않는다.
8. 월별 지출 한도는 사용자 선택 값; 하드코딩 금지. 손실 만회를 위한 차입/바이인 증가를 설계하지 않는다.
9. 수면·일·통근·식사·포커·공부 시간 중복을 분리한다. 장시간 딥런은 다음날 회복 비용에 영향을 주는 관측 변수로 다루되 인과 확정 금지.

## 향후 검증
- 합성 데이터로 입금→참가→수상→재입금→출금 흐름에서 중복계상 없는지 검사.
- 잔액/원장 정의 불일치 경고, 누락 원장 null 보존.
- 한 토너먼트 다수 핸드, 멀티엔트리, PKO 바운티, 무료 티켓, 미정산 중단 등 엣지 케이스.
- 초기에 수동 CSV/JSON으로 수입; 개인정보를 포함한 원본은 버전 관리 제외.
- UI: 실전 순손익/계좌이체/훈련성적/플레이시간 4가지 축 분리 시각화.
