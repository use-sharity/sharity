# Chat Benchmark Verification Runbook

Use this runbook after each agent finishes the in-app chat prototype.

## 1. Static Verification

Run from the agent worktree:

```bash
pnpm convex codegen
pnpm exec tsc --noEmit
pnpm lint
pnpm test
```

Record exact pass/fail status. If Convex codegen cannot run because of Node/runtime configuration, record that as an environment issue and inspect whether generated files were manually edited.

## 2. App Runtime

Expected local services:

```bash
pnpm convex:dev
pnpm dev --port 3001
```

Use `.env.local` without printing secrets. If port 3001 is busy, choose another port and set `BASE_URL`.

## 3. Auth Setup

Project E2E auth:

```bash
BASE_URL=http://localhost:3001 pnpm exec playwright test --project=setup --reporter=line
```

Requires:

- `CLERK_SECRET_KEY`
- `E2E_USER_A_EMAIL`
- `E2E_USER_B_EMAIL`

If this fails because Clerk test auth is unavailable, switch to visible browser/manual auth and record the limitation.

## 4. Functional Chat Flow

Minimum flow:

1. User B opens `/en` and starts a chat from an item card/detail surface.
2. User B sends: `Hi, is pickup today still OK?`
3. User A opens `/en/chat` and sees unread badge plus last message preview.
4. User A opens the thread and replies: `Yes, 7pm works.`
5. User B sees the reply without full reload.
6. User B reopens chat list and unread is cleared/read state is sane.
7. If claim lifecycle integration exists, approve/request a claim and verify a system message appears.

## 5. Visual Evidence

Capture at least:

- desktop chat list;
- desktop chat thread;
- mobile chat list;
- mobile chat thread.

Look for:

- composer visible and usable;
- messages not hidden behind mobile chrome;
- text not clipped;
- localized labels present;
- no route losing `/en`.

## 6. Review Checklist

Backend:

- Auth/authz present on every query/mutation.
- Participants are enforced.
- Users cannot chat with themselves or message conversations they do not belong to.
- Existing claim rules are unchanged.
- `convex/chat.ts` AI assistant remains intact.
- Generated Convex types are regenerated, not hand-maintained.

Frontend:

- Locale-safe navigation.
- Empty/loading/error states.
- Send button handles pending state.
- Read marking does not infinite-loop.
- UI works on mobile.

Benchmark:

- Capture command logs.
- Capture git diff stats.
- Run a review pass before scoring.
