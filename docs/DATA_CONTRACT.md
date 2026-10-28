# 데이터 계약 v0.1
현재는 사람이 적용하는 문서 계약이다. JSON Schema와 자동 검증기는 로드맵 M2에서 구현한다.

## 사실 레코드
| 필드 | 규칙 |
|---|---|
| id | FACT-0001 등 고유 ID, 재사용 금지 |
| domain | 생활/재정/역량/직장/건강/가족/시간/목표/포커 |
| key | 한 레코드에 한 의미, 예: monthly_net_salary |
| value | 숫자·문자·목록 또는 null, 미확인을 0으로 대체하지 않음 |
| unit | KRW, hour/week, date, text 등 |
| kind | verified / self_report / estimate / unknown / simulated |
| as_of | 해당 내용이 유효한 기준일, 모르면 null |
| recorded_at | 기록 시각, ISO 8601, +09:00 |
| source_ids | 근거 목록. verified와 self_report는 필수 |
| range | 추정 범위 min/max 또는 null |
| sensitivity | ordinary / personal / restricted |
| review_status | draft / confirmed / disputed / stale / superseded |
| supersedes | 정정 대상 id 또는 null |
| note | 단위 변환·정의·보류 사유 |

verified는 근거 자료로 확인했다는 뜻이며 미래에도 참이라는 뜻이 아니다.
self_report의 confirmed는 사용자가 기록이 자신의 진술과 맞음을 확인했다는 뜻이다.
simulated는 simulation에만 저장한다. 현실 파일에는 허용하지 않는다.

## 출처 레코드
id, type(user_statement/document/official_source), title, stated_at, checked_at, locator, redacted_summary.
locator는 대화 날짜·질문 번호 또는 공개 공식 자료 URL. 인증 토큰이 붙은 링크는 금지.
원본 증빙은 커밋하지 않으며 수치 확인 방법과 최소 요약만 남긴다.
출처 삭제가 필요하면 연결된 사실도 사용 가능 여부를 재검토한다.

## 기준점
id(BASE-YYYYMMDD-vN), as_of, status(draft/conditional/confirmed), fact_ids, assumptions, unresolved_ids,
user_reviewed_at, review_note, supersedes, financial_snapshot, time_budget, goals.
confirmed가 되려면 사용자 검토 기록과 QUALITY_GATES G2를 충족한다.
과거 기준점은 덮어쓰지 않는다. 보정본에 변경 이유를 남긴다.

## 가정
id(ASM-0001), variable, value/range, unit, rationale, source_ids, category,
applies_to, reviewed_at, expires_at, sensitivity, owner.
category: user_choice / modeling / external_forecast.
가정 변경은 model_version 또는 scenario revision을 바꾸고 재계산 대상을 명시한다.

## 시나리오와 TURN
scenario_id, baseline_id, baseline_commit, model_version, assumption_ids, pathway,
variant(conservative/base/optimistic), status(draft/valid/outdated), horizon_end.
turn_id(SIM-001), scenario_id, start_date, end_date, opening_state, options, selected_option,
implementation_rate, events, monthly_ledger, closing_state, checks, next_conditions.
경로가 다르면 turn_id 앞에 scenario_id를 함께 쓴다. 분기 번호만으로 덮어쓰지 않는다.

## 목표와 행동
목표: id, 원하는 상태, 최소/희망 수준, 기한, 일회/반복 비용, 선행 조건, 우선순위, 포기 불가 조건.
행동: id, goal_id, 시작·마감일, 예상 돈·시간, 완료 조건, 실제 결과, 관측 근거, 중단 조건.
행동 기록에서 선택함/시작함/완료함/보류함을 구분한다.

## 날짜·갱신·충돌
기록 기준일을 한국 시간으로 명시한다. 재무 잔액은 동일 날짜로 맞춘다.
급여·부채·현금은 매월, 생활 기능·시간은 최근 2주, 역량은 주요 프로젝트 종료 시 재검토하는 초기 주기다.
주기는 사용자 부담에 맞게 바꿀 수 있으며 자동 실행을 뜻하지 않는다.
동일 key·기준일에 다른 값이 있으면 disputed. 평균으로 덮지 말고 차이를 해소한다.
