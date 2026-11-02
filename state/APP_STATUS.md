# 웹 앱 진행

**2026-11-02: 배포됐다. https://dltkdals0118.github.io/LIFE/ 에서 동작한다.**

| 배포 검증 (직접확인 2026-11-02) | |
|---|---|
| 사이트 루트 | **200** — 앱 HTML |
| `/state/STATUS.md` · `/reality/facts.json` · `/AGENTS.md` | **404** — **개인 기록이 사이트에서 사라졌다** |
| 번들 | 200 · 586KB. Supabase URL·publishable key **주입 확인**, 비밀값 없음 |
| Supabase | 테이블 2개·함수 1개 생성됨. anon 접근은 `42501`로 **차단**(없는 테이블의 `PGRST205`와 대조해 확인) |
| CI | Actions `Deploy LIFE app` **success** — 테스트 8/8, 빌드 379ms |

**Pages 가 저장소 전체 대신 `app/dist` 만 서브한다.** 저장소 파일은 GitHub 에서 여전히 공개다(FACT-0177).

| | |
|---|---|
| 코드 | `app/` — Vite + React 19 + TypeScript. 다른 세션이 `%TEMP%` 에서 작업한 것을 옮겼다 |
| 설계 | 공개본 [docs/app/DESIGN.md](../docs/app/DESIGN.md) · 실제 수치가 든 사본 `docs/LIFE_APP_DESIGN.md`(로컬) |
| 테스트 | 단위·DB **8개 통과**(vitest + PGlite RLS) · e2e **8개 통과**(Playwright, desktop·mobile) |
| 빌드 | 통과. `dist` 621KB (JS 594KB / gzip 172KB) — 코드 분할은 아직 안 했다 |
| 배포 | `.github/workflows/deploy-app.yml` — `app/**` 변경 시 test → build → Pages. **`app/dist` 만 올린다** |
| 동기화 | 이메일 OTP 로그인 · IndexedDB 기기 저장 · `save_life_workspace` 충돌 감지. **Supabase 프로젝트 미연결** |

## Supabase 연결 (2026-11-02)
| | |
|---|---|
| 프로젝트 | `iqqugnixqnqmwduslwme.supabase.co` — **살아 있다**(GoTrue v2.197.0 응답, 직접확인) |
| 키 | 공개 **publishable key**. `app/.env`(gitignore) + Actions **Variables** 에 등록됨 |
| 번들 | 빌드 결과에 URL·publishable key 만 들어간다. 비밀 키는 없다(직접확인) |
| **막힌 것** | **테이블·함수가 아직 없다.** `life_workspaces` 조회가 `PGRST205`, RPC 가 `PGRST202` |

**사람이 해야 하는 것**: Supabase SQL Editor 에서 [`app/supabase/schema.sql`](../app/supabase/schema.sql) 을 한 번 실행한다.
우리에게는 service role key 가 없어 DDL 을 실행할 수 없다 — **그래야 로그인·두 기기 동기화가 동작한다.**
그전까지 앱은 **기기 저장(IndexedDB)만으로 정상 동작**하고, e2e 동기화 테스트는 라우트 모킹으로 통과한다.

## 공개 원격에 올리는 방법
`main` 에는 개인 기록이 섞여 있어 **통째로 push 하지 않는다**(아래 경계).
앱 전용 브랜치 **`public-app`** 이 `origin/main` 위에 앱 변경만 얹은 것이고, 이것만 올린다.
```
git push origin public-app:main
```

## 지켜야 하는 경계
**개인 기록이 들어 있는 로컬 브랜치를 공개 원격에 통째로 push 하지 않는다. 앱 변경만 반영한다.**
2026-11-02 에도 이 경계를 지켰다 — `app/` 과 `.github/` 만 `public-app` 에 담고
`reality/facts.json`(FACT-0173~0177)·`execution/`·`decisions/` 의 새 기록은 로컬 `main` 에 두었다.

저장소는 **PUBLIC 이고 본인이 그 상태를 유지하기로 했다**(FACT-0177).
다만 Pages 가 워크플로 배포로 바뀌면 **사이트에서는 앱만 보인다** — 저장소 파일은 GitHub 에서 여전히 공개다.

## 로그인 화면을 메인 앞에 세웠다 (2026-11-02, 사용자 요청 2차)
사용자: *"일반 로그인 화면이 아니라서 어렵다. 로그인 되었는지 직관적으로 확인되고,
메인 들어가기 전에 로그인 입력 화면이 나왔으면. 회원가입 / 비밀번호 재생성 기능과 UI도 필요."*

전에는 로그인이 **설정 화면 안에 숨어** 있었고, 로그인 버튼과 가입 링크가 한 줄에 겹쳐 있었다.
`Invalid login credentials` 가 영어로 떴고 **가입을 먼저 해야 한다는 안내가 없었다.**

| | |
|---|---|
| `src/Auth.tsx` 신규 | 메인 진입 전 **로그인 게이트**. 로그인·회원가입 **탭**, 비밀번호 확인, 재설정, 둘러보기 |
| 비밀번호 재설정 | `resetPasswordForEmail` → 메일 링크 → `PASSWORD_RECOVERY` 감지 → **새 비밀번호 화면** |
| 오류 문구 | 영어 응답을 한국어로 옮긴다 — 자격 불일치·이미 가입됨·메일 한도·짧은 비밀번호 |
| 로그인 상태 | 사이드바에 **이메일 전체 / `로그인 안 됨` + 로그인 버튼** 으로 표시 |
| 통과 경로 | `로그인 없이 둘러보기`(예시) · `이 기기에만 저장하고 시작하기`(기기 저장) — `life:gate` 로 기억 |
| 시험 | e2e **20개 통과**. 게이트·로그인·오류 안내·가입·재설정·두 통과 경로를 모두 덮는다 |

## 로그인을 비밀번호 방식으로 바꿨다 (2026-11-02, 사용자 요청)
매직링크(메일 링크 클릭 = 로그인)는 **기기를 추가할 때마다 메일을 기다려야 하고**
무료 플랜 기본 메일은 **시간당 2통**이라 두 기기를 묶는 데 쓸 수 없었다.
사용자가 *"로그인이 일반적이지가 않아서 이해가 안 된다"* 고 했고 **이메일 + 비밀번호**를 택했다.

| | |
|---|---|
| 바뀐 것 | `signInWithOtp` → **`signInWithPassword`**, 가입용 `signUp` 추가(비밀번호 8자 이상) |
| 화면 | `설정과 동기화` 에 이메일·비밀번호 입력 + `로그인` / `계정 만들고 시작하기` 전환 |
| 시험 | **`e2e/auth.spec.ts` 신규** — 로그인 폼을 실제로 통과시킨다. 기존 `sync.spec` 은 세션을 심어 폼을 건너뛰어서 **'로그인이 안 된다'를 잡지 못했다** |

**Supabase 쪽에서 할 것 하나**: Authentication → Sign In / Providers → Email 의 **`Confirm email` 을 끄면**
가입 즉시 로그인되어 **메일이 아예 필요 없어진다.** 켜 두면 가입 때 확인 메일 1통이 필요하다.
개인용 앱이고 본인만 쓰므로 끄는 쪽이 실용적이다 — **판단은 본인 몫**이다.

## 코드 분할 — 시도했고 보류했다 (2026-11-02)
`manualChunks` 로 react·supabase 를 가르려다 **빌드가 네이티브 크래시**했다(rolldown Go runtime panic).
Vite 8 은 rolldown 기반이라 rollup 의 `manualChunks` 가 그대로 듣지 않는다.
**되돌렸고 다시 시도하지 않는다** — 단일 페이지라 첫 화면에 전부 필요해 분할 이득이 작고,
gzip 172KB 는 동작에 문제가 없다. 다시 한다면 `build.rolldownOptions.output.advancedChunks` 쪽이다.

## 로컬 테스트가 가끔 죽는다 — 코드 문제가 아니다
`src/database.test.ts`(PGlite = WASM Postgres)가 메모리 압박에서 **exit 134**로 죽는다.
**같은 커밋이 CI 에서는 8/8 통과한다**(Actions 로그 직접확인). 브라우저를 많이 띄운 상태에서 재현된다.
로컬에서 막히면 `npx vitest run --no-file-parallelism` 또는 다른 앱을 닫고 다시 돌린다.

## 다음
1. **두 기기 실연동 검증** — PC·휴대폰에서 같은 이메일·비밀번호로 로그인해 퀘스트가 건너가는지
2. `private_raw/life-app-import.json` 으로 실제 기록 가져오기 — **로컬에서만**, 공개 빌드에 넣지 않는다
3. 워크플로의 Node 20 deprecation 경고(actions/checkout@v4 등) 정리
