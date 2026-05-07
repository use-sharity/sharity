# Sharity Codex Context Index

This is the compact context entrypoint for Codex runs in this repository.

## Load Order

1. `AGENTS.md` is automatically loaded by Codex and contains the broad project rules.
2. `context/bootstrap.md` is the project bootstrap packet for orchestrators and
   project-scoped worker sessions.
3. Use repo skills in `.agents/skills` for progressive disclosure:
   - `sharity-context` for task bootstrap.
   - `sharity-convex` for Convex backend work.
   - `sharity-react` for UI work.
   - `sharity-playwright` for browser/E2E verification.
   - `sharity-benchmark` for Claude versus Codex comparisons.
4. Read only the context notes needed for the current task:
   - `convex.md`
   - `react-ui.md`
   - `testing.md`
   - `in-app-chat.md`
   - `benchmark.md`
   - `memory.md`

## Current Project Shape

- Next.js 16 App Router with locale routes under `app/[locale]`.
- React 19 and TypeScript strict mode.
- Convex is the backend and realtime database.
- Clerk provides auth; Convex functions use `ctx.auth.getUserIdentity().subject`.
- Tailwind CSS 4 and shadcn/ui are the UI base.
- `convex/chat.ts` is the Sharry AI assistant module, not user-to-user messaging.

## Standing Constraints

- Do not commit, push, open PRs, send emails, or send Telegram messages unless explicitly asked.
- Do not print secrets.
- Do not read production Convex with revoked deploy keys.
- Preserve unrelated user work and interrupted agent work.
- Prefer small, verifiable changes over broad rewrites.
- Preserve durable learnings through `sharity-memory`: update focused context/skills when a reusable rule appears, and keep one-off handoff state out of global instructions.

## Common Checks

```bash
pnpm convex codegen
pnpm exec tsc --noEmit
pnpm lint
pnpm test
BASE_URL=http://localhost:3001 pnpm exec playwright test --reporter=line
python3 scripts/context_memory_audit.py --days 30
```

Record any environment blocker exactly.
