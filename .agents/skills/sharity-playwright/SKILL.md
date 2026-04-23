---
name: sharity-playwright
description: Playwright and browser-verification workflow for Sharity. Use when adding or testing UI flows, auth-dependent E2E tests, mobile behavior, screenshots, or benchmark verification.
---

# Sharity Playwright Verification

Use together with `.codex/context/testing.md`.

## Project E2E Setup

- Config: `playwright.config.ts`.
- Tests live in `e2e/`.
- Base URL defaults to `http://localhost:3001`.
- `globalSetup` uses `@clerk/testing/playwright`.
- Auth setup writes `playwright/.auth/user-a.json` and `playwright/.auth/user-b.json`.
- Required environment variables: `CLERK_SECRET_KEY`, `E2E_USER_A_EMAIL`, `E2E_USER_B_EMAIL`.

Never print secret values. Load env files silently if needed.

## Claude Playwright Skill Compatibility

Claude has a browser automation skill installed at:

`/Users/dmitrysurkov/.claude/plugins/cache/playwright-skill/playwright-skill/4.1.0/skills/playwright-skill`

Its pattern is:

1. Detect dev servers.
2. Write temporary scripts to `/tmp/playwright-test-*.js`.
3. Run them through the skill executor:

```bash
cd /Users/dmitrysurkov/.claude/plugins/cache/playwright-skill/playwright-skill/4.1.0/skills/playwright-skill
node run.js /tmp/playwright-test-*.js
```

Codex can use either the project Playwright runner (`pnpm exec playwright test`) or the same executor for parity. Prefer project tests for persistent coverage and temporary scripts for fast visual/manual-flow probes.

## Sharity Chat Verification Flow

For the in-app chat prototype, the minimum browser check is:

1. Start app on port 3001 and Convex dev.
2. Authenticate as user A and user B.
3. As borrower, open an item and start/message owner.
4. As owner, open chat list and verify unread badge/preview.
5. Send a reply and verify realtime delivery in the borrower context.
6. Mark the thread read and verify unread clears.
7. Capture desktop and mobile screenshots of chat list and thread.

## Evidence

Save benchmark evidence under `.codex/benchmarks/runs/<timestamp>/`:

- Playwright command output.
- Screenshots.
- Any trace or video path.
- A short note saying what was checked and what was not checked.
