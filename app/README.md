# LIFE web app

A calm, visual workspace for plans A/B/C, quests, domain growth, observations, weekly reflection and digital / real-world rewards.

## Run

Node 24. From `app/`:

```sh
npm ci
npm run dev
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The app uses `/LIFE/` as its base path. The Pages workflow publishes **only `app/dist`**. It never copies `reality/`, `execution/` or repository history to the web build. No personal records are embedded in demo data.

## Storage modes

- Demo: synthetic data, in-memory interactions, no private uploads.
- Device workspace: IndexedDB persistence, JSON export/import. This is **not cross-device sync**.
- Signed-in workspace: private Supabase database, **email + password auth**, revision-based sync, offline queue and explicit conflict resolution. Same account on both devices is required.

Cloud connection is optional for the deployed UI but **required for automatic phone/PC sync**. Until it is configured, the UI says the data is saved only on this device. A browser reset can delete unsynced local records; export backups.

## Connect cloud sync

1. Create a Supabase project under your account. Execute [`supabase/schema.sql`](supabase/schema.sql) in its SQL editor. This installs owner-only read policy and a transactional, revision-checked save RPC. Do not grant direct table writes.
2. Under Authentication URL Configuration, set site URL to `https://dltkdals0118.github.io/LIFE/` and allow that same URL as a redirect. Enable email authentication. Configure email sending and allowed signups for your intended users. Production email delivery depends on the project's provider configuration and limits.
3. Find the project URL and **publishable key**. Never use `sb_secret_` or `service_role` keys in the frontend.
4. Either enter the URL and public key in the app's Settings → 동기화 서비스 연결 설정 on each device, or set GitHub Actions repository variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` and rerun the deployment workflow. These are public client configuration; authorization is enforced by auth + database policies.
5. Log in using the same email on PC and phone. The app starts a separate account workspace. To migrate your device records, export before logging in and explicitly import the backup after logging in. Import replaces the entire account workspace and displays a confirmation preview.
6. Verify: create a quest on PC, wait for “동기화됨”, open phone, complete it, verify one completion/XP. Test offline editing and reconnect. Do not call sync production-verified until a real project passes these checks.

## Sync contract

The account DB is authoritative. Each device saves an envelope with `revision`, `requestId`, `dirty` and the workspace. Polling every 5 seconds plus focus/online events fetches changes. Requests have a UUID; retrying a request is idempotent. Server compares base revision under a per-user transaction lock. Concurrent changes stop for explicit whole-workspace selection; there is no silent last-write-wins merge. Export the local version before choosing. Field-level merge is a later improvement.

New login/account switch selects a distinct cache key. Pending records are not transferred between users. Successful sign-out removes the account cache; pending records block sign-out until synchronized. Expired authentication leaves device records for reconnection. Stored data validation rejects unknown schemas, duplicate IDs and invalid references. Workspace payloads are limited to 4 MB.

## What this version supports

- Create/edit/pause/delete quests, completion/undo and domain XP / milestone visualization.
- Create/edit A/B/C plans with target, cost, weekly time, duration, alternative transition cost and manual switching history.
- Compare resource feasibility against dated observations; what-if simulation never modifies real records.
- Cash/time/sleep/poker cash-transfer observations and history; weekly reflections.
- Digital badge unlock; real reward reservation and actual spend tracking against an explicit cumulative reward budget.
- Demo/personal separation, backup/restore, account sync adapter and SQL installation.

## Explicit limits

- Conditional transition notes are reminders, not a natural-language rule engine. Resource shortages are computed; plan switching is explicit.
- Success probabilities remain unestimated; resource feasibility is not a prediction of success. Monthly cash forecast and distribution-based simulation are later work.
- Cash observations are snapshots. Reward spend is tracked in the reward budget and does not subtract again from observed cash. Imported bank-transaction matching/refunds and budget period rollover are not implemented.
- Growth badges are implemented; a full cosmetic inventory / character editor is not yet included.
- Existing LIFE fact/source files are not accepted as app backups directly. They require deliberate mapping; this prevents silently importing private source material or confusing dated facts with current balances.

## Verification

`npm test`: domain behavior plus local PostgreSQL (PGlite) tests for revision conflicts, retry idempotency and owner isolation. These do not substitute for testing a configured Supabase deployment. Playwright checks desktop/mobile use, persistence, rewards and overflow. Screenshots and test output are ignored by Git.

Official integration references: [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [password sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [Vite Pages deployment](https://vite.dev/guide/static-deploy.html).
