---
name: sharity-push-preview
description: "Safely deploy Sharity feature work to a Vercel Preview from the current feature branch. Use when Dmitry says: sharity preview, preview коллегам, превью коллегам, deploy preview, push preview, vercel preview, ссылка коллегам, не main, не production, feature preview, or clients must not see it yet."
---

# Sharity Push Preview

Use only inside `/Users/dmitrysurkov/Developer/Personal/sharity-vinhloc`.

Goal: create or inspect a Vercel Preview deployment in the real Sharity/Vinhloc
Vercel project that colleagues can test, without touching `main`, production
domains, or production promotion.

## Link Types

Do not mix these up:

- Vercel Git Preview: best for colleagues. Created by pushing a feature branch
  to `use-sharity/sharity`, then Vercel's Git integration builds it under the
  real Sharity/Vinhloc Vercel project. It usually looks like
  `sharity-git-<branch-with-dashes>-sharity-dalats-projects.vercel.app`.
  Known current example:
  `https://sharity-git-feature-in-app-chat-sharity-dalats-projects.vercel.app`.
- Vercel CLI Preview: only OK if `vercel teams ls` / `vercel whoami` confirms
  the CLI is authenticated in the real Sharity/Vinhloc scope. If `.vercel` or
  `vercel project list` points to `dmitrys-projects-264251c7`, stop: that is
  Dmitry's personal Vercel, not the shareable team preview target.
- Cloudflare quick tunnel: best for Dmitry testing local dev on iPhone. It lives
  on `*.trycloudflare.com`, depends on local Next + Convex + tunnel processes,
  and dies when the laptop/processes stop.
- Production: customer-facing. Requires `main`, production deploy, or promote.
  Do not use for colleague preview unless Dmitry explicitly asks.

## Short Commands

Treat these as direct commands:

- `sharity preview`
- `preview коллегам`
- `превью коллегам`
- `deploy preview`
- `push preview`
- `vercel preview`
- `ссылка коллегам`
- `preview no main`

## Hard Guards

- Do not merge into `main`.
- Do not push to `main`.
- Do not run `vercel --prod`, `vercel deploy --prod`, `vercel promote`, or
  production rollback.
- Do not alias the preview to a production/customer domain.
- If changing project-wide Vercel protection settings, stop and ask first.
- Keep secrets out of output. Never print Vercel, Clerk, or Convex tokens.
- Do not deploy to `dmitrys-projects-264251c7` for colleague previews unless
  Dmitry explicitly asks for a personal-scope preview.
- If a stale `.vercel/project.json` points at `dmitrys-projects-264251c7`, move
  it out of the active repo path before any deploy attempt.

## Preflight

Run these from the repo root:

```bash
git branch --show-current
git status --short
cat .vercel/project.json
pnpm dlx vercel@latest whoami
pnpm dlx vercel@latest teams ls
pnpm dlx vercel@latest project list --format json
pnpm dlx vercel@latest project protection sharity-vinhloc
```

Personal-scope warning:

```text
dmitrys-projects-264251c7
```

If this is the only Vercel scope available, do not run `vercel deploy --yes`
for a colleague preview. Use the Git preview route or ask Dmitry to log the CLI
into the Sharity/Vinhloc Vercel account/team.

If current branch is `main`, stop unless Dmitry explicitly asked for production.

## Deploy Routes

Preferred: Git preview under the Sharity/Vinhloc Vercel project.

1. Confirm branch is a feature branch, not `main`.
2. Commit only intended changes.
3. Push the feature branch to `origin`.
4. Watch GitHub PR/Vercel checks or Vercel dashboard for the generated preview.
5. Give that generated preview URL.

Only use direct CLI deploy when the CLI is authenticated to the correct
Sharity/Vinhloc Vercel scope:

```bash
pnpm dlx vercel@latest deploy --yes
```

Capture:

- deployment URL
- inspect URL
- deployment id
- target/status
- git metadata from `vercel inspect`

Then inspect:

```bash
pnpm dlx vercel@latest inspect <deployment-url>
```

## Link Access

Check whether the public link opens without Vercel auth:

```bash
curl -I -L <deployment-url>/en
```

Interpretation:

- `200`, `307`, or app-level auth redirect: link reaches Sharity.
- `401` with Vercel SSO/protection: colleagues outside the Vercel team may not
  open it.

If protected, prefer a targeted alias/shareable-link bypass over changing
project-wide protection. If the exact bypass command is unclear, report the
protected link and blocker instead of disabling SSO globally.

## Final Output

Always say:

- current branch used;
- whether `main` was touched (`no`, unless explicitly true);
- whether production deploy/promote happened (`no`, unless explicitly true);
- preview URL;
- inspect URL;
- link access status: public, Vercel-protected, or shareable-link;
- what a colleague should open.

Keep the final short and explicit. If the link is protected, say that plainly.
