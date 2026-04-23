---
name: sharity-convex
description: Convex backend patterns for Sharity. Use when editing convex schema, queries, mutations, internal functions, scheduler calls, activity trails, notifications, email actions, or generated Convex API types.
---

# Sharity Convex Patterns

Use together with `.codex/context/convex.md`.

## Mandatory Pattern

For Convex functions:

1. Validate auth with `ctx.auth.getUserIdentity()`.
2. Fetch required docs and fail with clear errors.
3. Enforce authorization with Clerk user IDs.
4. Apply business rules before writes.
5. Record lifecycle/activity events when the surrounding module does so.
6. Return a narrow result.

## Local Rules

- `convex/chat.ts` is already used by Sharry AI assistant. Do not reuse that module name for user-to-user chat.
- Keep user-to-user messaging functions in a separate module such as `convex/messaging.ts`.
- Never manually edit generated Convex API files as a durable fix. Run codegen through Convex when possible; if a temporary manual patch exists, call it out and replace it before finalizing.
- Do not read production Convex with revoked deploy keys.
- Never print secrets from `.env.local`, `.env.*`, Keychain, or `~/.config/sharity/secrets.env`.

## Verification

Run the narrowest useful checks:

```bash
pnpm convex codegen
pnpm exec tsc --noEmit
pnpm lint
```

If Node/Convex tooling fails because of the local runtime, record the exact blocker and what was verified instead.

## Runtime Notes

- Before running non-trivial Convex tasks, read `.codex/context/convex.md`, including the Convex runbook section.
- `pnpm convex:dev` is the normal Claude-style watch/deploy/codegen command for this repo.
- If Convex rejects the current Node runtime for `use node` actions, run the Convex CLI with a supported Node such as `/Applications/Codex.app/Contents/Resources/node` (Node 24 in the local Codex app bundle). Keep Next.js on the normal Homebrew/system Node if native SWC fails under the bundled runtime.
- Never switch `.env.local` to cloud/prod values silently. State the target deployment class before running any Convex command that can read or write data.
