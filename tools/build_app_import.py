# -*- coding: utf-8 -*-
"""앱에 넣을 초기 데이터를 만든다. 작성: WACUS

    python tools/build_app_import.py            # private_raw/life-app-import.json 생성
    python tools/build_app_import.py --print    # 내용만 출력

왜 스크립트인가: 출력 파일은 `private_raw/`(gitignore)라 이력이 남지 않는다.
**무엇을 넣었는지는 이 파일이 기록한다.** 값을 고치려면 여기를 고치고 다시 돌린다.

지킬 것
- **확인된 값만 넣는다.** 추정이면 note 에 적는다. 없는 값을 지어내지 않는다.
- **수면은 넣지 않는다** — 최근 3일치뿐이고 날짜 대응이 추정이다(FACT-0073). 본인이 오늘부터 적는다.
- 보상·예산은 비워 둔다. 본인이 정할 몫이다.
- 스키마는 `app/src/model.ts` 의 workspaceSchema 다. 바뀌면 여기도 바꾼다.
"""
import argparse
import json
import re
from pathlib import Path
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

DOMAINS = [
    {"id": "finance", "name": "재정 운영", "color": "sage", "icon": "wallet"},
    {"id": "recovery", "name": "회복 습관", "color": "teal", "icon": "sprout"},
    {"id": "career", "name": "일과 성장", "color": "blue", "icon": "briefcase"},
    {"id": "learning", "name": "배움", "color": "amber", "icon": "book"},
    {"id": "relationships", "name": "관계", "color": "rose", "icon": "heart"},
    {"id": "creative", "name": "창작", "color": "violet", "icon": "sparkles"},
]

# 확인된 관측만. 출처를 note 에 남긴다.
OBSERVATIONS = [
    ("obs-cash-20260730", "cash", 14_000_000, "2026-07-30", "자기보고 · 과거 기준점"),
    ("obs-cash-20261028", "cash", 6_000_000, "2026-10-28", "자기보고 · FACT-0062"),
    ("obs-cash-20261031", "cash", 5_000_000, "2026-10-31", "본인 확인 · FACT-0176"),
    ("obs-pokerout-202610", "poker-out", 2_600_000, "2026-10-31",
     "10월 은행→빗썸 합계 20만×13건 · FACT-0174 · 월 합계를 월말에 한 줄로"),
    ("obs-pokerin-202610", "poker-in", 1_674_593, "2026-10-31",
     "10월 빗썸→은행 실수령 4건 · FACT-0174 · 순유출 925,407원"),
    # 새 항목(2026-11-03)의 출발값. 확인된 것만 넣는다.
    # **열 이름을 함께 읽는다** — 4,112,686 은 '카페·간식+식비'이지 실지출이 아니다(그렇게 한 번 틀렸다).
    # `spend` 는 **월 총유출(이체 포함)** 이다. 유입과 짝이 맞아야 적자가 나온다.
    # 실지출(이체 제외)은 6,802,360 이고 그건 G1 트래커가 따로 센다 — 같은 이름으로 섞지 않는다.
    ("obs-spend-202610", "spend", 8_268_480, "2026-10-31",
     "10월 거래 달력 유출 전체(이체 1,466,120 포함) · FACT-0173 · 실지출만 보면 6,802,360"),
    ("obs-inflow-202610", "inflow", 4_806_321, "2026-10-31",
     "10월 거래 달력 유입 전체(월급 외 포함) · FACT-0173 · 적자는 유출 − 유입이다"),
    ("obs-debt-20261102", "debt", 47_000_000, "2026-11-02",
     "토스 + KB · 월 납입 790,000 · 금리 7.8%대 · FACT-0178"),
    ("obs-income-20261028", "income", 2_600_000, "2026-10-28",
     "세후 월급. 급여 외 수입 없음 · FACT-0060·0103"),

    # 본인이 앱에 직접 넣은 기록. 가져오기는 **덮어쓰기**라 여기 없으면 사라진다 —
    # 백업과 대조해서 건졌다(2026-11-03). 앱에 직접 넣은 것은 이 목록에 올려야 살아남는다.
    ("obs-pokerout-20261101", "poker-out", 200_000, "2026-11-01",
     "본인이 앱에 직접 기록 · 11월 첫 포커 송금 · FACT-0194"),
    ("obs-hours-20261029", "hours", 16.5, "2026-10-29",
     "주 가용 추정 · 평일 6.5h(포커 5h/일 기준) + 주말 10h · FACT-0166·0168. 보수적인 쪽"),
]

# 반복 기록 습관과, 지금 비어 있는 칸을 채우는 확인 작업.
# due 를 흩어 두어 '오늘 할 일'이 3개를 넘지 않게 한다.
# (id, 제목, 분야, 분, XP, 마감, 완료기준, 플랜, 반복)
# 매일·매월 하는 것은 반복으로 둔다 — 완료하면 다음 회차가 자동으로 생긴다.
# (id, 제목, 분야, 분, XP, 마감, 완료기준, 플랜, 반복)
# **매일 하는 것은 반복으로 둔다** — 완료하면 다음 회차가 자동으로 생기고, 완료 기록은 그대로 남는다.
# 그래야 '몇 번 중 몇 번을 끝까지 했나'(완주율)를 셀 수 있다.
QUESTS = [
    ("q-cash-monthly", "현금 잔액 한 줄 — 이게 유일한 입력이다", "finance", 1, 5, "2026-11-30",
     "input/inbox.tsv 에 `<날짜>  cash  <잔액>` 한 줄을 적고 커밋했다. 나머지 숫자는 전부 여기서 나온다.", "plan-g1", "monthly"),
    ("q-sleep-daily", "잠들기 전, 오늘의 수면 기록", "recovery", 2, 5, "2026-11-03",
     "취침·기상 시각 또는 총 수면시간을 적었다.", "plan-sleep", "daily"),
    ("q-math", "칸아카데미 수학 15분", "learning", 15, 10, "2026-11-03",
     "15분을 풀었다. 포커의 확률·기댓값과 겹치는 단원부터.", "plan-study", "daily"),
    ("q-english", "포커 중에 영어 자료 하나", "learning", 10, 8, "2026-11-03",
     "전략 글·포럼·핸드 리뷰 중 하나를 영어로 읽었다. 포커 시간 안에서 한다.", "plan-study", "daily"),
    ("q-read", "책 10쪽", "learning", 15, 10, "2026-11-03",
     "과학·사회 분야로 10쪽. 다 이해하지 않아도 된다.", "plan-study", "daily"),
    ("q-loan-toss", "토스 대출 조건 확인", "finance", 20, 15, "2026-11-08",
     "잔액·금리·고정변동·중도상환수수료·남은 기간을 적었다. 11월 예정에 3건이 보인다.", "plan-debt", "none"),
    ("q-loan-kb", "KB 대출 조건 확인", "finance", 20, 15, "2026-11-08",
     "같은 다섯 가지를 적었다. 10/26 KBSAVINGS 236,940원이 이 상환인지도 함께 확인.", "plan-debt", "none"),
    ("q-telecom", "통신 요금제와 약정 확인", "finance", 30, 15, "2026-11-08",
     "기본료 구성·약정 만료일·위약금을 적었다. 화면에 KT 24,800 과 U+ 164,907 이 따로 보인다.", "plan-g1", "none"),
    ("q-subscriptions", "쓰지 않는 정기결제 정리", "finance", 30, 15, "2026-11-09",
     "쿠팡·토스프라임·스포티파이·넷플릭스 합 29,880원. 해지한 것과 월 절감액을 적었다.", "plan-g1", "none"),
    ("q-housing", "주거 계약서에서 만료일과 통보 기한 확인", "finance", 15, 15, "2026-11-15",
     "만료일(2027-04 추정)과 갱신 통보 기한을 계약서로 확인했다. 결정 시점이 2027-01~02 다.", "plan-housing", "none"),
    ("q-body-daily", "10분 몸 쓰기", "recovery", 10, 8, "2026-11-03",
     "푸시업·스쿼트·스트레칭 중 하나를 10분 했다. 이게 체력 스탯을 올리는 기본 회로다.", "plan-fitness", "daily"),
    ("q-body-strength", "근력운동 한 번", "recovery", 60, 15, "2026-11-08",
     "헬스장이든 집이든 근력 위주로 한 번 했다.", "plan-fitness", "weekly"),
    ("q-body-weight", "체중 적기", "recovery", 3, 5, "2026-11-09",
     "체중을 앱에 기록했다. 숫자 하나로 추세가 보이는 가장 싼 건강 지표다.", "plan-fitness", "weekly"),
    ("q-body-checkup", "건강검진 대상인지 확인", "recovery", 30, 15, "2026-11-22",
     "국민건강보험 홈페이지나 1577-1000 으로 올해 국가건강검진 대상인지 확인했다. 대상이면 예약까지.", "plan-fitness", "none"),
    ("q-credit-counsel", "신용회복위원회에 전화로 물어보기", "finance", 30, 12, "2026-11-15",
     "1600-5500 에 전화해 ① 상담만으로 기록이 남는지 ② 연체 전 신속채무조정 대상인지 ③ 금리 7.8% 가 조정되는지 셋을 물었다. 무료다.", "plan-floor", "none"),
    ("q-promo-terms", "과장 승진 조건 확인", "career", 30, 20, "2026-11-16",
     "승진 시점과 **승진 후 세후 월급**을 확인했다. 적자 0 기준선은 세후 377만이다. 외부 오퍼 회신도 정리했다.", "plan-job", "none"),
    ("q-ontime", "이번 주 지각 횟수 적기", "career", 3, 8, "2026-11-09",
     "지각 횟수를 앱에 기록했다. 수면 기록과 함께 쌓이면 몇 주 안에 연결이 보인다 — 지금은 가설이다(FACT-0199).", "plan-sleep", "weekly"),
    ("q-tell-doctor", "진료 때 '출근에 영향이 생겼다' 전하기", "recovery", 10, 15, "2026-11-30",
     "수면 문제가 일상 기능(출근)에 영향을 주기 시작했다고 의료진에게 전했다. 약·진단은 우리가 정하지 않는다.", "plan-sleep", "none"),
    ("q-resume", "이력서·포트폴리오 최신화", "career", 120, 25, "2026-11-16",
     "DX 자동화·SEO 자동화·웹블로그 발행 경력을 이력서에 반영했다. 회사 산출물 자체를 쓰지 않고 역할과 결과로 적었다.", "plan-job", "none"),
    ("q-dx-meeting", "DX — 팀장 미팅 잡기", "career", 15, 10, "2026-11-20",
     "주간보고서 자동화 건으로 팀장 미팅 일정을 잡았다. 배정 절차의 첫 단계다.", "plan-dx", "none"),
    ("q-dx-interview", "DX — 실무 인터뷰", "career", 60, 20, "2026-11-27",
     "1~4팀에서 주요고객사 1곳씩 받고 실무자가 주간보고서를 어떻게 쓰는지 들었다.", "plan-dx", "none"),
    ("q-dx-draft", "DX — 1차 자동화 방안", "career", 90, 25, "2026-12-12",
     "자동화 방안을 문서로 냈다. 1차 기간이 11월이다.", "plan-dx", "none"),
    ("q-tf-insight", "TF — 자사 인사이트 글 올리기", "career", 40, 15, "2026-11-30",
     "브랜딩 TF 건으로 자사 홈페이지 인사이트/아티클을 업데이트했다.", "plan-work", "weekly"),
    ("q-webapp", "웹앱 — BGN 플로우 확인", "career", 30, 15, "2026-11-12",
     "Figma 플로우를 보고 기획 쪽에서 내가 맡을 범위를 적었다. 기획자 합류 여부도 확인.", "plan-work", "none"),
    ("q-projects", "맡은 프로젝트 네 가지 정리", "career", 20, 15, "2026-11-09",
     "각 프로젝트의 공식 마감과 평가 기준을 확인했다. 실체와 역할은 2026-11-03 에 정리됐다(FACT-0187).", "plan-work", "none"),
    ("q-review-nov", "11월 월간 검토", "career", 40, 20, "2026-11-30",
     "현금 잔액·실지출·포커 순유출·고정비 정리 결과를 모아 적었다.", "plan-g1", "none"),
]

# 플랜은 '지금 하는 것' 하나로 끝나지 않는다. **무너질 때와 열릴 때를 미리 적어 두는 것**이 ABC 다.
# 전부 저장소 기록에 근거가 있다. 활성 경로(active)는 지금 실제로 가고 있는 길로 맞췄다.
# rule 이 있으면 조건이 맞을 때 앱이 스스로 신호를 낸다.
def _p(pid, title, goal, domain, active, branches):
    return {"id": pid, "title": title, "goal": goal, "domainId": domain, "active": active,
            "branches": [{"key": k, "title": t, "cost": c, "hours": h, "duration": d,
                          "result": r, "trigger": tg, "rule": rl, "switchCost": 0}
                         for k, t, c, h, d, r, tg, rl in branches]}

PLANS = [
    # ── 1. 지출 (G1, 1순위) ──
    _p("plan-g1", "월 지출 100만 줄이기", "11·12월 지출을 10월보다 월 100만 낮춘다", "finance", "A", [
        ("A", "본인이 정한 배분대로", 0, 2, 90, "식비 30만 · 쇼핑 30만 · 포커 바이인 40만 축소",
         "두 달 연속 식비 상한을 못 지키면 B 로", {"when": "outcomes", "recent": 4, "weak": 3, "to": "B"}),
        ("B", "고정비 먼저 — 의지가 덜 드는 쪽", 0, 3, 90, "통신·보험·대출금리 조건을 바꿔 매달 자동으로 줄인다",
         "조건 변경이 불가하거나 절감이 10만 미만이면 A 로", None),
        ("C", "기록만 이어간다", 0, 0.5, 90, "월말 현금과 실지출만 빠짐없이 적는다",
         "세 번 연달아 해내면 다시 올라간다", {"when": "streak", "full": 3, "to": "A"}),
    ]),
    # ── 2. 부업 (G2, 후순위지만 적자 0 에는 필수) ──
    _p("plan-side", "부업 첫 거래 만들기", "돈이 입금된 유상 거래 1건. 금액은 상관없다", "career", "C", [
        ("A", "무상 진단서로 콜드 아웃리치", 0, 5, 90, "에이전트로 만든 SEO 진단서를 보내 첫 거래를 만든다",
         "30일 접촉 0건이면 접근을 바꾼다", {"when": "idle", "days": 30, "to": "C"}),
        ("B", "아는 경로부터", 0, 2, 90, "전 직장·지인 경로로 한 건을 먼저 만든다",
         "인맥 경로가 막히면 A 로", None),
        ("C", "자산만 쌓는다 (지금)", 0, 1, 90, "진단서 틀과 사례를 모아 두고 영업은 미룬다",
         "지출 절감이 두 달 연속 목표선을 넘으면 A 로 올린다", None),
    ]),
    # ── 3. 포커 (불가침 취미 FACT-0122. 줄이자는 제안이 아니라 '흔들렸을 때'를 미리 정해 두는 것) ──
    # 임계 300만은 10월 송금 실측 260만(FACT-0174)보다 위다. 지금 수준은 신호를 내지 않고
    # **그보다 더 나갈 때만** 알린다. 규칙이 보는 것은 송금액이고 회수는 보지 않는다 —
    # 10월 순유출은 92.5만이었다. 두 숫자를 섞지 않는다.
    _p("plan-poker", "포커 자금이 흔들릴 때", "통장에서 나가는 돈을 내가 정한 선 안에 둔다", "finance", "A", [
        ("A", "지금 선을 지킨다", 0, 0.2, 90, "월 통장 순유출을 본인이 정한 상한 안에서",
         "한 달 송금이 300만을 넘으면 B 로 (송금 기준 — 회수는 보지 않는다)",
         {"when": "observation", "kind": "poker-out", "op": "gt", "value": 3_000_000, "to": "B"}),
        ("B", "상한을 절반으로", 0, 0.2, 90, "같은 방식으로 하되 월 상한을 절반으로 낮춘다",
         "현금이 300만 아래로 내려가면 C 로", None),
        ("C", "기록만 하고 잠시 쉰다", 0, 0.1, 90, "입출금만 적고 신규 송금을 멈춘다",
         "현금이 회복되면 A 또는 B 로", None),
    ]),
    # ── 4. 이직·연봉 (퇴사 2027-01~03, 연봉협상 2027-01) ──
    _p("plan-job", "이직 — 제안이 왔다", "매드코퍼레이션 제안(FACT-0195) + 현 직장 입지 악화(FACT-0196). 적자 0 기준선은 세후 월 377만", "career", "C", [
        ("A", "간다 — 매드코퍼레이션", 0, 3, 90, "SEO/GEO 팀원 **오퍼**. 세후 377만 이상이면 적자 0 사정권",
         "**자동 아님.** 세후 월급·고용형태·입사시점·회신기한을 받은 뒤 고른다", None),
        ("B", "남는다 + 조건을 바꾼다", 0, 2, 120, "DX 11월 성과 → 2027-01 협상. **공식 조치가 없어 회복 가능한 종류다**(FACT-0196)",
         "**자동 아님.** 세후 월급을 받아 377만과 비교한 뒤 고른다", None),
        ("C", "조건을 받아본다 (지금)", 0, 1, 30, "면접·오퍼로 숫자를 확정한다. A·B 중 무엇도 닫지 않는다",
         "현금이 300만 아래로 내려가면 고를 여유가 없어진다 — 그 전에 정한다",
         {"when": "observation", "kind": "cash", "op": "lt", "value": 3_000_000, "to": "A"}),
    ]),
    # ── 5. 주거 (만료 2027-04, 결정 시점 2027-01~02 — 고정비의 40%) ──
    _p("plan-housing", "주거 2027-04 만료", "월 95만을 줄이거나, 줄일 수 없다면 그 이유를 안다", "finance", "C", [
        ("A", "더 싼 곳으로 옮긴다", 1_000_000, 4, 150, "통근 1시간 안에서 월세를 낮춘다",
         "통근 조건을 못 맞추면 B 로", None),
        ("B", "재계약하되 조건을 본다", 0, 2, 120, "인상 없이 재계약하거나 조건을 조정한다",
         "인상 요구가 있으면 A 로", None),
        ("C", "먼저 알아본다 (지금)", 0, 1, 90, "계약서의 만료일·통보 기한을 확인하고 시세만 본다",
         "2027-01 이 되면 A 또는 B 를 정해야 한다", None),
    ]),
    # ── 6. 채무 (4,700만 · 7.8% · 월 이자 30.6만) ──
    _p("plan-debt", "채무 조건 바꾸기", "납입액의 39%인 이자를 줄인다", "finance", "C", [
        ("A", "두 건 모두 전환을 시도", 0, 3, 90, "토스·KB 각각 더 낮은 금리로 갈아탄다",
         "한 쪽이라도 막히면 B 로", None),
        ("B", "금리 높은 쪽만", 0, 2, 90, "둘 중 비싼 쪽 하나만 바꾼다",
         "전환이 모두 불가하면 C 로", None),
        ("C", "조건부터 확인 (지금)", 0, 1, 60, "건별 금리·중도상환수수료·고정변동을 적는다",
         "조건이 모이면 A 또는 B 로", None),
    ]),
    # ── 7. 회복 (DEC-002 — 안정화의 둘째 축) ──
    _p("plan-sleep", "수면과 회복", "지각이 입지 악화의 원인이 됐다(FACT-0199) — 이제 건강이 아니라 소득 문제다", "recovery", "C", [
        ("A", "취침 시각을 고정한다", 0, 0.5, 90, "같은 시각에 눕고 7시간 이상",
         "수면이 6시간 아래로 내려가면 B 로", {"when": "observation", "kind": "sleep", "op": "lt", "value": 6, "to": "B"}),
        ("B", "주말만이라도 회복", 0, 0.3, 90, "주말에 몰아서라도 부족분을 메운다",
         "평일이 안정되면 A 로", None),
        ("C", "기록부터 (지금)", 0, 0.1, 90, "취침·기상 시각만 매일 적는다",
         "2주치가 모이면 A 또는 B 를 정한다", {"when": "streak", "full": 10, "to": "A"}),
    ]),
    # ── 8. 기초 학습 (FACT-0185) ──
    # **수능을 목표로 두지 않았다.** 목적이 밝혀지지 않았고(D-006) 수능 5영역 중 직접 덮는 것이 0이다.
    # 대신 '기초를 다시 쌓기'로 둔다 — 포커(확률·기댓값)·부업(영어 자료)·'책 출간'(FACT-0120)에 모두 붙는다.
    # 추가로 드는 시간은 하루 30분뿐이다. 영어는 포커 시간 안에서 간다.
    _p("plan-study", "기초를 다시 쌓기", "포커 실력·영어 실력을 겸사겸사. 하루 30분씩 쌓이는 이게 본체다", "learning", "C", [
        ("A", "셋 다 — 수학·영어·책", 0, 3.5, 180, "수학 15분 + 포커 중 영어 + 책 10쪽",
         "다섯 번 중 세 번을 못 지키면 B 로", {"when": "outcomes", "recent": 5, "weak": 3, "to": "B"}),
        ("B", "포커에 바로 붙는 것만", 0, 1.8, 180, "수학과 영어만. 포커 실력으로 바로 돌아온다",
         "열 번 연달아 해내면 A 로", {"when": "streak", "full": 10, "to": "A"}),
        ("C", "책 10쪽부터 (지금)", 0, 1.8, 180, "가장 가벼운 하나만 매일",
         "일곱 번 연달아 해내면 B 로", {"when": "streak", "full": 7, "to": "B"}),
    ]),
    # ── 9. 회사에서 맡은 일 (FACT-0186) ──
    # **이름 넷만 받았다.** 내용·역할·기간·상태는 미확인이라 각 프로젝트를 따로 플랜으로 쪼개지 않았다.
    # ABC 는 프로젝트별 경로가 아니라 **업무 전체를 어떻게 끌고 갈지**다 —
    # '직장은 계속 다니되 라이트하게'(FACT-0125)와 맞물리는 축이다.
    _p("plan-work", "회사에서 맡은 일", "마케팅 4팀 · DX · TF 셋 · 웹앱 기획 · 블로그 발행과 자동화", "career", "A", [
        ("A", "넷 다 끌고 간다", 0, 40, 120, "맡은 네 가지를 모두 진행한다",
         "수면이 6시간 아래로 내려가면 B 로", {"when": "observation", "kind": "sleep", "op": "lt", "value": 6, "to": "B"}),
        ("B", "핵심 둘에 집중", 0, 32, 120, "가장 중요한 둘만 밀고 나머지는 유지만",
         "그래도 버거우면 C 로", None),
        ("C", "맡은 것만 지킨다", 0, 28, 120, "새 일을 받지 않고 지금 것만 끝낸다",
         "여유가 생기면 B 로 — '라이트하게 다닌다'(FACT-0125)와 가장 가까운 경로", None),
    ]),
    # ── 13. 몸 (요청 2026-11-03: "운동이나 전투력도 빼놓을 수 없으니") ──
    # 운동 → recovery XP → **체력 스탯** → 전투력. 게임 층과 같은 회로에 물린다.
    _p("plan-fitness", "몸 — 체력이 전투력이다", "운동으로 recovery 레벨을 올린다. 체력 스탯이 그대로 전투력에 들어간다", "recovery", "C", [
        ("A", "주 4회 운동 + 매일 걷기", 0, 6, 90, "근력 4회와 매일 걷기. 체력 스탯이 가장 빨리 오른다",
         "다섯 번 중 세 번을 못 지키면 B 로", {"when": "outcomes", "recent": 5, "weak": 3, "to": "B"}),
        ("B", "주 2회 근력 + 매일 스트레칭", 0, 3, 90, "무리하지 않는 선. 습관이 끊기지 않는다",
         "열 번 연달아 해내면 A 로", {"when": "streak", "full": 10, "to": "A"}),
        ("C", "매일 10분 몸 쓰기 (지금)", 0, 1.2, 90, "푸시업·스쿼트·스트레칭 중 하나. 수면이 먼저 잡혀야 늘린다",
         "일곱 번 연달아 해내면 B 로", {"when": "streak", "full": 7, "to": "B"}),
    ]),

    # ── 12. 바닥 (FACT-0191 · 0192 · simulation/LAST_RESORT_20261103.md) ──
    # 자동 전환 규칙을 두지 않는다 — 법적·재정 판단은 H2 이고 앱이 정할 일이 아니다.
    _p("plan-floor", "바닥 — 다 안 됐을 때", "개인회생·채무조정. 바닥을 정해두면 위에서 질 수 있는 위험의 한도가 정해진다", "finance", "C", [
        ("A", "개인회생 (3단)", 0, 0, 1095, "월 110~117만 × 36개월. 이자 중단·총지급 1,700만 감소. **월 부담은 +31~38만 늘어난다**",
         "**자동 아님.** 소득 있고 지출이 통제됐고 포커를 멈춘 상태여야 한다. 전문가 상담 먼저", None),
        ("B", "신용회복위원회 채무조정 (2단)", 0, 0, 90, "법원 안 간다. 이자 감면·기간 조정. 연체 전에도 신속채무조정이 된다",
         "**자동 아님.** 연체 위험이 보이면 1600-5500", None),
        ("C", "아직 1단이다 (지금)", 0, 0, 90, "금리 인하 요구권·대환·무료 상담. 연체 전이라 선택지가 가장 많다",
         "신규 대출로 생활비·포커를 메우는 순간 또는 현금 200만 아래 → B 상담", None),
    ]),

    # ── 11. 대학 진학 (FACT-0188 · 0189 · simulation/UNIVERSITY_20261103.md) ──
    # 동기가 자기 증명이라 외부 마감이 없다. 그래서 '언제'를 돈 사정에 맞춰도 목적이 상하지 않는다.
    # A·B 는 둘 다 적자 0 뒤에 온다 — 지금 전업은 현금 2.2개월로 불가능하다.
    _p("plan-univ", "대학 — 열어두는 문", "집중해서 달려가는 길이 아니다. 포커·영어 실력이 쌓이다 보면 열리는 문으로 둔다", "learning", "C", [
        ("A", "전업 1년", 27_480_000, 8, 365, "적자 0 + 현금 2,700만 확보 후 1년 집중. 가장 빠르고 가장 위험하다",
         "**자동으로 넘어오지 않는다.** 본인이 그러기로 정할 때만", None),
        ("B", "직장 유지하며 2~3년", 0, 14, 1095, "하루 2~3시간을 매일. 수입을 지키고 느리게 간다",
         "**자동으로 넘어오지 않는다.** 본인이 그러기로 정할 때만", None),
        ("C", "겸사겸사 쌓는다 (지금)", 0, 3.5, 180, "포커·영어 실력이 본체다. 대학은 그 부산물로 열린다",
         "여기가 기본값이다. 집중 모드로 바꾸는 것은 본인 결정이다", None),
    ]),

    # ── 10. DX 주간보고서 자동화 (FACT-0187) ──
    # 11/02 배정, **1차 기간 11월**. 90일 계획에 없던 기한 있는 업무다.
    # 범위를 줄일 수 있는 일이라 ABC 가 실제로 쓰인다.
    _p("plan-dx", "DX — AI 주간보고서 자동화", "1~4팀 주요고객사 1곳씩으로 주간보고서 자동화 방안을 낸다 (1차 11월)", "career", "A", [
        ("A", "실제로 도는 자동화까지", 0, 6, 28, "인터뷰 → 방안 → 동작하는 1차 자동화",
         "11월 중순까지 인터뷰가 안 끝나면 B 로", {"when": "idle", "days": 12, "to": "B"}),
        ("B", "초안 자동 생성까지", 0, 4, 28, "보고서 초안을 AI가 만들고 사람이 다듬는 수준",
         "시간이 더 부족하면 C 로", None),
        ("C", "방안 문서까지", 0, 2, 28, "어떻게 자동화할지 문서로 내고 구현은 다음 차수로",
         "여유가 생기면 B 로", None),
    ]),
]

# 보상은 '사실'이 아니라 **본인이 정하는 장치**다. 비워 두면 기능이 죽으므로 기본 세트를 넣는다.
# **전부 바꾸라고 둔 값이다** — 앱에서 제목·금액·조건을 고치고 지우면 된다.
#
# 고른 근거: 관심은 **음악·미술·포커**이고 하고 싶은 것은 **앨범 발매·책 출간·포커 대회 출전**이다(FACT-0120).
# 그래서 보상도 그 방향의 **작은 첫 걸음**으로 뒀다. 금액은 미확인이라(FACT-0141) 자리만 잡아 둔 값이다.
#
# XP 는 월 300 쯤 쌓인다고 보고 잡았다(퀘스트 20개 × 15XP).
#   250 ≈ 한 달 · 600 ≈ 두 달 · 900 ≈ 세 달(= 90일 계획 완주) · 1200 ≈ 넉 달
# 큰 보상일수록 멀리 둔 이유는, 오래 이어간 사람만 받는 것이 보상이기 때문이다.
REWARDS = [
    # ── 가까운 것 ── 시작하자마자 한 번은 받는다
    ("rw-first",   "첫 발자국",              "digital", 0,       30,  "",           "무엇이든 하나를 끝까지 해낸 날"),
    ("rw-morning", "알람 없는 주말 아침",      "real",    0,      100,  "recovery",   "돈이 들지 않는 가장 좋은 보상"),
    # ── 한두 달 ── 먹고 싶었던 것, 읽고 싶었던 것
    ("rw-meal",    "먹고 싶었던 한 끼",        "real",    50_000, 250,  "",           "벼르던 곳으로. 금액은 고쳐 주세요"),
    ("rw-book",    "읽고 싶었던 책 한 권",     "real",    20_000, 300,  "learning",   "다 읽지 않아도 된다"),
    ("rw-album",   "좋아하는 앨범 한 장",      "real",    30_000, 400,  "creative",   "음악은 관심 분야다(FACT-0120)"),
    ("rw-month",   "한 달을 이어간 사람",      "digital", 0,      500,  "",           "꾸준함은 크기보다 횟수다"),
    ("rw-show",    "보고 싶던 전시 한 번",     "real",    25_000, 600,  "creative",   "미술도 관심 분야다"),
    # ── 세 달 이상 ── 갖고 싶었던 것, 나가고 싶었던 자리
    ("rw-thing",   "갖고 싶었던 물건 하나",    "real",   200_000, 900,  "",           "90일을 이어간 보상. 무엇인지·얼마인지는 직접 적어 주세요"),
    ("rw-tourney", "포커 대회 출전",          "real",   300_000, 1200, "",           "일상 바이인이 아니라 '하고 싶은 것'의 대회(FACT-0120). 참가비는 대회마다 다릅니다"),
    ("rw-habit",   "끝까지 가는 습관",        "digital", 0,      1500, "",           "절반이 아니라 끝까지가 쌓였을 때"),
]
# 전체 누적 예산(월별로 초기화되지 않는다).
# **절감에 성공한 돈의 일부**를 보상으로 돌린다는 뜻의 자리값이다 — 써야 하는 돈이 아니라 쓸 수 있는 한도다.
# 큰 보상은 XP 조건이 높아 몇 달은 걸린다. **바꿀 값이다.**
REWARD_BUDGET = 300_000

EVENTS = [{"id": "ev-import", "at": "2026-11-02T14:00:00+09:00",
           "text": "확인된 10월 기록을 가져왔다 — 현금 3건, 포커 2건, 가용시간 1건"}]


def build():
    return {
        "schemaVersion": 1,
        "name": "나의 LIFE",
        "chapter": "선택지를 지키며 생활 안정화",
        "domains": DOMAINS,
        # 2026-11-09: 앱이 시뮬레이션과 일기 둘만 남아 퀘스트·플랜·보상을 내보내지 않는다.
        # QUESTS·PLANS·REWARDS 정의는 아래에 그대로 두었다 — 되살리려면 이 세 줄만 바꾸면 된다.
        "quests": [], "plans": [], "rewards": [], "rewardBudget": None,
        "journal": [],      # 웹이 주인이다. 엔진은 빈 배열을 보내고 sync 가 서버 것을 지킨다.
        "_quests_disabled": [{"id": i, "title": t, "domainId": d, "minutes": m, "xp": x, "due": due,
                    "status": "ready", "criterion": c, "partialCriterion": "", "minimumCriterion": "",
                    "planId": p, "repeat": rp, "completedAt": None, "outcome": None}
                   for i, t, d, m, x, due, c, p, rp in QUESTS],
        "observations": [{"id": i, "kind": k, "value": v, "date": d, "note": n}
                         for i, k, v, d, n in OBSERVATIONS],
        "reviews": [],
        "sim": sim_block(),
        "curriculum": curriculum_block(),
        # 진도와 고른 조합은 **웹이 주인**이다. 엔진은 빈 값을 보내고 sync 가 서버 것을 지킨다.
        "simPicks": {}, "curriculumDone": [],
        "events": EVENTS,
    }


def curriculum_block():
    """커리큘럼 정의를 앱으로 넘긴다. 진도(done)는 웹이 가지므로 여기 담지 않는다."""
    p = Path(__file__).resolve().parent.parent / "sim" / "curriculum.json"
    if not p.exists():
        return None
    c = json.loads(p.read_text(encoding="utf-8"))
    return {k: c[k] for k in ("title", "subtitle", "areas", "phases", "weeks") if k in c}


def sim_block():
    """예측 엔진이 낸 값 + 레버를 앱으로 넘긴다.
    앱이 직접 굴려야 '고른 것에 따라 결과가 갈리는' 시뮬레이션이 된다 — 보고서를 보여주는 게 아니라."""
    root = Path(__file__).resolve().parent.parent
    fc, sc = root / "simulation" / "_forecast.json", root / "sim" / "scenarios.json"
    if not (fc.exists() and sc.exists()):
        return None
    f = json.loads(fc.read_text(encoding="utf-8"))
    g = json.loads(sc.read_text(encoding="utf-8"))
    return {
        "asOf": f["made_on"], "cash": f["cash_now"], "netMonthly": f["net_monthly"],
        "startMonth": f["start"], "months": f["months"],
        "flowBasis": f.get("flow_basis", ""), "incomeNow": f.get("income_now"),
        "baseFreeHours": g.get("base_free_hours"),   # FACT-0097 하루 남는 시간
        "groups": g.get("groups", []),
        "levers": [{"id": l["id"], "name": l["name"], "starts": l["starts"],
                    "group": l.get("group", ""), "basis": l.get("basis", ""),
                    "options": [{"key": o["key"], "label": o["label"], "delta": o["delta"],
                                 "hours": o.get("hours", 0),
                                 "requires": o.get("requires", [])} for o in l["options"]]}
                   for l in g["levers"]],
    }


def check_against_model(data):
    """생성기와 앱 스키마가 어긋나는지 **model.ts 를 직접 읽어** 본다.

    2026-11-09: repeat 에 'monthly' 를 넣었는데 스키마에 없어 가져오기가 통째로 거부됐다.
    생성기를 고치고 검증기를 따로 돌려야 했던 것이 원인이라, 생성기가 스스로 보게 했다.
    (전체 검증은 app/tools/verify-import.mjs 가 한다 — 이건 빠른 1차 그물이다.)
    """
    src = (Path(__file__).resolve().parent.parent / "app" / "src" / "model.ts").read_text(encoding="utf-8")

    def allowed(field):
        m = re.search(field + r":z\.enum\(\[([^\]]*)\]\)", src)
        return set(re.findall(r"'([^']+)'", m.group(1))) if m else None

    problems = []
    for field, rows in (("repeat", [q["repeat"] for q in data["quests"]]),
                        ("status", [q["status"] for q in data["quests"]]),
                        ("kind", [o["kind"] for o in data["observations"]])):
        ok = allowed(field)
        if ok is None:
            problems.append(f"model.ts 에서 {field} 목록을 못 찾았다 — 검사를 건너뛴다")
            continue
        bad = sorted(set(rows) - ok)
        if bad:
            problems.append(f"{field}: {bad} 는 앱 스키마에 없다 (허용: {sorted(ok)})")
    ids = [q["id"] for q in data["quests"]] + [p["id"] for p in data["plans"]]
    dup = sorted({i for i in ids if ids.count(i) > 1})
    if dup:
        problems.append(f"중복 ID: {dup}")
    plans = {p["id"] for p in data["plans"]}
    orphan = sorted({q["planId"] for q in data["quests"] if q["planId"] and q["planId"] not in plans})
    if orphan:
        problems.append(f"없는 플랜을 가리키는 퀘스트: {orphan}")
    return problems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--print", action="store_true", dest="show")
    a = ap.parse_args()
    data = build()
    data.pop("_quests_disabled", None)      # 정의를 들고 다니지 않는다
    problems = check_against_model(data)
    if problems:
        print("앱 스키마와 어긋난다 — 이대로 가져오면 거부된다:")
        for x in problems:
            print("  " + x)
        return 1
    text = json.dumps(data, ensure_ascii=False, indent=1) + "\n"
    if a.show:
        print(text)
        return
    out_dir = os.path.join(ROOT, "private_raw")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "life-app-import.json")
    with open(out, "w", encoding="utf-8", newline="") as fh:
        fh.write(text)
    print(f"썼다: {out}")
    print(f"  분야 {len(data['domains'])} · 퀘스트 {len(data['quests'])} · "
          f"플랜 {len(data['plans'])} · 관측 {len(data['observations'])}")
    sim = data.get("sim") or {}
    print(f"  손잡이 {len(sim.get('levers') or [])}개 · 일기는 웹이 주인이라 비워 보낸다")
    print("  수면은 넣지 않았다 — 3일치뿐이고 날짜 대응이 추정이다. 오늘부터 본인이 적는다.")
    print("  보상은 '사실'이 아니라 바꾸라고 둔 기본값이다. 제목·금액·조건을 앱에서 고치면 된다.")
    print("  관심(음악·미술·포커)과 하고 싶은 것(앨범·책·대회)을 근거로 골랐다 — FACT-0120.")


if __name__ == "__main__":
    main()
