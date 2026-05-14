---
name: sharity-two-user-localhost
description: "Open the Sharity local multi-user manual test harness: two Playwright Chrome windows side by side, signed in as different users. Use when Dmitry says: sharity two users, sharity multiuser, two users, два юзера, два пользователя, две сессии, два окна, playwright рядом, owner borrower, borrower owner, or как обычно рядом. Localhost only by default, without Cloudflare."
---

# Sharity Two-User Localhost

Use when Dmitry asks to open two Sharity windows, two users, two different
logins, owner/borrower, multi-user test, manual harness, two Playwright
windows, two browsers side by side, or "как обычно рядом".

## Short Commands

Treat these as direct commands:

- `sharity two users`
- `sharity multiuser`
- `два юзера`
- `два пользователя`
- `две сессии`
- `два окна`
- `playwright рядом`
- `owner borrower`
- `borrower owner`

## Command

Run from the Sharity repo:

```bash
BASE_URL=http://localhost:3002 node scripts/open-two-user-localhost.mjs
```

The script opens:

- left window: `playwright/.auth/user-a.json`
- right window: `playwright/.auth/user-b.json`
- two separate browser contexts, so auth/session state is isolated
- default URL: `.codex/manual-review/latest-manual-harness.json` item URL,
  converted to the current localhost origin
- on macOS, the script reads `NSScreen.visibleFrame`, which accounts for menu
  bar and Dock placement, then sets each Playwright window through Chrome
  DevTools Protocol. It keeps a conservative bottom edge by default so
  Sharity's bottom chat composer stays visible. Do not pass Retina pixel width
  such as `2048` unless you really mean macOS logical points.
- the browser context uses the real headed Chrome viewport (`viewport: null`);
  do not reintroduce a fixed Playwright viewport equal to the outer window size,
  because Chrome toolbar height will hide bottom-fixed UI such as the chat
  composer.
- by default, the script closes stale `Google Chrome for Testing` windows before
  opening the two-user harness. Override with `CLOSE_STALE_CHROME=0` only when
  you intentionally want to keep old Chrome-for-Testing windows.

## Before Running

- Confirm Next dev is reachable on `localhost:3002`.
- Confirm Convex dev is running in the repo tmux session.
- If the user says "разные залогиненные люди", use this skill. Do not open two
  tabs in one context, because they would share one user session.
- Cloudflare is not needed for desktop testing. Stop any stale `cloudflared`
  process if Dmitry wants a localhost-only setup.
- For a separate macOS Desktop/Space, switch to that Space first, then run the
  command there. macOS does not expose reliable CLI control for creating a
  split-view Space, but the script will tile the windows in the active Space.

## Useful Overrides

```bash
BASE_URL=http://localhost:3002 \
LEFT_URL=/en/item/<itemId> \
RIGHT_URL=/en/item/<itemId> \
node scripts/open-two-user-localhost.mjs
```

Window tuning:

```bash
TILE_WINDOWS=1 \
node scripts/open-two-user-localhost.mjs
```

Keep the command running so the windows stay open. Press `Ctrl+C` in the
terminal to close both windows.
