---
name: sharity-react
description: React and Next.js UI patterns for Sharity. Use when editing app routes, components, shadcn/ui composition, next-intl messages, mobile layouts, or user-facing flows.
---

# Sharity React UI Patterns

Use together with `.codex/context/react-ui.md`.

## Component Rules

- Client components start with `"use client";`.
- Hooks stay at the top; derived values use `useMemo` when useful; event handlers use `useCallback` when passed around or non-trivial.
- Use `next-intl` message keys for visible copy. Update `messages/en.json`, `messages/vi.json`, and `messages/ru.json` together.
- Use existing shadcn/ui components from `components/ui`.
- Use lucide icons when adding icon buttons or navigation affordances.
- Keep mobile-first layouts dense and task-oriented. Avoid landing-page composition for app surfaces.

## Navigation Rules

- Locale routes live under `app/[locale]`.
- Client navigation should preserve locale when possible. Prefer route helpers or the current locale from `next-intl` rather than hard-coding `/chat/...` from a localized page.
- Check `components/mobile-tab-bar.tsx` and `components/app-header.tsx` before adding app-wide entry points.

## Verification

Run:

```bash
pnpm exec tsc --noEmit
pnpm lint
```

For mobile UX changes, inspect with Playwright or a browser at a mobile viewport when feasible.
