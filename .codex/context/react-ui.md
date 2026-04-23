# React UI Context

## Important Files

- Locale routes: `app/[locale]/*`.
- Main feed: `app/[locale]/page.tsx`, `components/discovery-items-list.tsx`, `components/discovery-card.tsx`.
- My items and claims: `app/[locale]/my-items/page.tsx`, `components/my-items-list.tsx`, `components/lease/*`.
- App chrome: `components/app-header.tsx`, `components/mobile-tab-bar.tsx`.
- Translations: `messages/en.json`, `messages/vi.json`, `messages/ru.json`.
- Shared UI: `components/ui/*`.

## UI Rules

- Build app screens, not marketing pages.
- Mobile-first matters for Sharity; verify tight layouts and keyboard behavior.
- Use existing shadcn/ui components and lucide icons.
- Keep cards for repeated items or modals; avoid nested cards.
- Visible copy must be translated in all three locale files.

## Routing

- Pages under `app/[locale]` receive locale-prefixed URLs.
- From localized client components, avoid hard-coded non-locale paths where possible.
- Check current navigation components before adding new app-wide entry points.

## Verification

- `pnpm exec tsc --noEmit`
- `pnpm lint`
- Browser or Playwright check for mobile flows when a visual route changes.
