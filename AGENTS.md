# Sharity Instructions

## Project Guard

This is the canonical active Sharity repository:
`/Users/dmitrysurkov/Developer/Personal/sharity-vinhloc`.

Treat `dalat-sharity` as the archived Supabase prototype unless Dmitry names it
explicitly. Run Sharity code, previews, and verification only from this repo.

## Read First

- `README.md` for product/setup.
- `.agents/skills/sharity-context/SKILL.md` for bounded task intake.
- `.codex/context/` for compact maintained context.
- Read the matching repo skill only when the task needs it:
  `sharity-convex`, `sharity-react`, `sharity-playwright`, or
  `sharity-production-deploy`.

## Canonical Commands

```bash
pnpm dev
pnpm convex:dev
pnpm test
pnpm lint
pnpm exec biome check .
pnpm build
pnpm memory:audit
```

Browser verification requires both `pnpm dev` and `pnpm convex:dev`; a loaded
Next.js page alone is not a valid Sharity runtime check.

## Durable Invariants

- Next.js App Router UI lives under `app/` and `components/`; Convex schema,
  queries, mutations, actions, crons, and email templates live under `convex/`.
- Clerk provides identity; every protected Convex handler must authenticate and
  authorize against current data before mutation.
- When a route/client supplies a Convex document ID as a string, normalize it
  with `ctx.db.normalizeId("<table>", id)` rather than deployment-specific
  regex validation.
- Keep locale-aware email strings in `convex/emailTemplates/i18n.ts`; new email
  flows must carry locale through template, action, and scheduler call site.
- Preserve existing TypeScript/Biome style and source boundaries. Derive state
  from the current schema/functions rather than copying inventories here.

## Safety Gates

- Never put Clerk/Convex/test user identifiers, email addresses, API keys, or
  other credentials in instructions, code examples, logs, or git. Two-user E2E
  uses env-provided identities and two explicitly authenticated browser
  contexts; verify auth on the exact origin under test.
- Seed/reset/migration/admin functions and production deploys are mutations.
  Run them only when the task explicitly authorizes the exact environment and
  scope.
- External mail, analytics, tunnels, and paid eval providers require explicit
  scope and available credentials. Default checks stay local.
- Do not commit, amend, push, or open a PR without explicit instruction. The
  Husky pre-commit hook runs `pnpm lint-staged` and may rewrite staged files;
  inspect the resulting diff/status before any user-authorized commit.

## Verification

Use the smallest checks that cover the change: focused Vitest, lint/Biome, and
build/type validation. User-facing flows also need browser/Playwright evidence;
two-user flows need distinct authenticated contexts. Never claim a live Convex
check when only the frontend was running.

For meaningful work report result, files changed, exact commands/checks and
results, remaining work, blockers, and continuation status.
