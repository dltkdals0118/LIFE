# ADR-001 — 문서와 기준점을 중심으로 단계적 구현
- 날짜: 2026-10-28
- 상태: 설계 초판의 구조 결정. 개인 사실·개인 경로 결정은 아님.
- 요청: LIFE를 WACUS_Agents 수준의 구조와 디테일로 설계하고 GitHub에서 관리.

## 참고한 자료
- https://github.com/dltkdals0118/WACUS_Agents/blob/main/README.md
- https://github.com/dltkdals0118/WACUS_Agents/blob/main/.claude/commands/intake.md
- https://github.com/dltkdals0118/WACUS_Agents/blob/main/.claude/commands/plan.md
- https://github.com/dltkdals0118/WACUS_Agents/blob/main/.claude/agents/judge.md
- https://github.com/dltkdals0118/WACUS_Agents/blob/main/work/_topology.json
확인한 트리 참조: 8e46a9f592e3c300321371e5b6297450d4754990.
전체 파일 내용을 전수 검토한 것은 아니다.

## 선택
운영 프롬프트·역할·절차·정본·검수·상태를 분리한다.
LIFE는 자체 정본으로 유지한다. reality/simulation/execution을 분리한다.
실제 수치가 없는 상태에서는 문서 계약을 먼저 정하고 엔진 구현은 단계적으로 진행한다.
조사 TURN 1과 가상 SIM 번호를 분리한다.

## 대안
단일 대화 프롬프트: 초기 비용은 낮지만 출처·상태·계산 추적이 어렵다.
WACUS 시스템 전체 복제: 성숙한 구조가 있으나 고객 작업·팀 운영·PC 정본 전제가 LIFE와 다르다.
앱 먼저 제작: 사용성이 보이나 데이터·모델 검증 전 숫자가 권위 있게 보일 위험이 있다.

## 결과와 재검토
문서 운영은 즉시 가능하다. 자동화는 아직 없다.
조사 후 입력 구조가 달라지면 데이터 계약을 버전 변경한다.
문서 관리 부담이 크면 역할·파일을 합치되 정본·출처·현실/가상 구분은 유지한다.
