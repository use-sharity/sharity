# sharity-vinhloc Bootstrap

## Purpose

Canonical active Sharity product repository: a sharing-economy app for lending,
borrowing, and managing item availability and requests.

This is the active project for Sharity work:

```text
/Users/dmitrysurkov/Developer/Personal/sharity-vinhloc
```

The archived `dalat-sharity` Supabase prototype is legacy. Do not route active
Sharity product work there unless Dmitry explicitly names it.

## Read First

- `AGENTS.md`
- `.codex/context/index.md`
- `.codex/context/memory.md`
- `.codex/context/testing.md`
- `.codex/context/convex.md`

For UI/frontend work, also read:

- `.codex/context/react-ui.md`

For in-app/user-to-user chat, also read:

- `.codex/context/in-app-chat.md`

For benchmark or Claude-vs-Codex comparison work, also read:

- `.codex/context/benchmark.md`

## Hard Rules

- Do not commit, push, open PRs, send emails, or send Telegram messages unless
  Dmitry explicitly asks.
- Do not print secrets.
- Preserve unrelated user work and interrupted agent work.
- Active Sharity work belongs in this repository, not archived `dalat-sharity`.
- Convex is required runtime infrastructure for meaningful local verification.
  Do not treat a loaded Next.js page as a valid Sharity check until the Convex
  dev process/database route has been considered.
- For owner/requester flows, use two browser contexts authenticated as different
  Clerk users.
- No PowerShell on Dmitry's Windows/HCP Anywhere route; use Python, CMD, or
  `.bat`.

## Routes

Default local app route:

```text
Next.js: pnpm dev
Convex: pnpm convex:dev
Default browser base URL: http://localhost:3000 or task-specific BASE_URL
```

Cloudflare/iPhone testing requires tunnel-origin auth, not localhost auth state.

## Run / Test

Baseline checks after code changes:

```bash
pnpm convex codegen
pnpm exec tsc --noEmit
pnpm lint
pnpm test
```

Browser/E2E:

```bash
BASE_URL=http://localhost:3001 pnpm exec playwright test --reporter=line
```

Memory/context audit:

```bash
python3 scripts/context_memory_audit.py --days 30
```

Record exact environment blockers instead of smoothing them over.

## Worker Contract

Return:

- state: `done | partial | blocked | review_needed`;
- files changed;
- checks/screenshots/browser verification performed;
- whether Convex and Next runtimes were verified;
- risks or blockers;
- next action.
