# 웹 앱 진행

**2026-11-02: 구현이 저장소에 들어왔고 테스트가 통과했다.**

| | |
|---|---|
| 코드 | `app/` — Vite + React 19 + TypeScript. 다른 세션이 `%TEMP%` 에서 작업한 것을 옮겼다 |
| 설계 | 공개본 [docs/app/DESIGN.md](../docs/app/DESIGN.md) · 실제 수치가 든 사본 `docs/LIFE_APP_DESIGN.md`(로컬) |
| 테스트 | 단위·DB **8개 통과**(vitest + PGlite RLS) · e2e **8개 통과**(Playwright, desktop·mobile) |
| 빌드 | 통과. `dist` 621KB (JS 594KB / gzip 172KB) — 코드 분할은 아직 안 했다 |
| 배포 | `.github/workflows/deploy-app.yml` — `app/**` 변경 시 test → build → Pages. **`app/dist` 만 올린다** |
| 동기화 | 이메일 OTP 로그인 · IndexedDB 기기 저장 · `save_life_workspace` 충돌 감지. **Supabase 프로젝트 미연결** |

## 지금 막힌 것
**Supabase 프로젝트 URL 과 공개 publishable key 가 있어야 두 기기 실연동 검증을 마친다.**
없이도 앱은 기기 저장만으로 동작하고, e2e `sync.spec.ts` 는 라우트 모킹으로 통과한다.
키는 `app/.env`(gitignore)에 넣는다. 배포에는 Actions **Variables** 로 주입한다.

## 지켜야 하는 경계
**개인 기록이 들어 있는 로컬 브랜치를 공개 원격에 통째로 push 하지 않는다. 앱 변경만 반영한다.**
2026-11-02 에도 이 경계를 지켰다 — `app/` 과 `.github/` 만 푸시하고
`reality/facts.json`(FACT-0173~0177)·`execution/`·`decisions/` 의 새 기록은 로컬에 두었다.

저장소는 **PUBLIC 이고 본인이 그 상태를 유지하기로 했다**(FACT-0177).
다만 Pages 가 워크플로 배포로 바뀌면 **사이트에서는 앱만 보인다** — 저장소 파일은 GitHub 에서 여전히 공개다.

## 다음
1. Supabase 연결 → 두 기기 검증
2. 코드 분할(594KB 단일 청크)
3. `private_raw/life-app-import.json` 으로 실제 기록 가져오기 — **로컬에서만**, 공개 빌드에 넣지 않는다
