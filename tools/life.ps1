# LIFE 재개 — 작성: WACUS
#
#   powershell -File tools/life.ps1                     # 상태 출력 후 Codex 대화 시작
#   powershell -File tools/life.ps1 -StatusOnly         # 상태만 보고 끝
#   powershell -File tools/life.ps1 -Prompt "11월 현금 잔액 560만 기록해줘"
#   powershell -File tools/life.ps1 -Exec -Prompt "..."  # 비대화식 (codex exec)
#
# 이 스크립트는 예약·상주 프로세스를 만들지 않는다. 사용자가 직접 실행할 때만 돈다.
param(
  [string]$Prompt = "",
  [switch]$Exec,
  [switch]$StatusOnly
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root   # AGENTS.md 가 적용되는 자리에서 돈다

python "$Root/tools/next.py"
if ($StatusOnly) { exit 0 }

if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
  Write-Host ""
  Write-Host "codex 를 찾지 못했다. 상태 출력까지만 했다." -ForegroundColor Yellow
  Write-Host "설치: npm i -g @openai/codex   (또는 claude 로 이어가도 된다)"
  exit 1
}

if (-not $Prompt) {
  $Prompt = "LIFE 저장소다. life 스킬로 이어가 줘. skills/life/SKILL.md 와 AGENTS.md 를 먼저 읽고, " +
            "위 tools/next.py 출력에 나온 이번 주 행동부터 진행해라. 필요한 파일만 열어라."
}

Write-Host ""
Write-Host "--- codex 시작 ($(if ($Exec) {'exec'} else {'대화'})) ---" -ForegroundColor Cyan
if ($Exec) { codex exec $Prompt } else { codex $Prompt }
