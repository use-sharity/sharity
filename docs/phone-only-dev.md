# Testing Sharity on a real iPhone — phone-only dev loop

How I've been iterating on the Sharity mobile swipe deck without opening a laptop: a public HTTPS preview of the local dev server via Cloudflare Tunnel, plus a persistent Claude Code session on the Mac that I drive over SSH from the phone.

Covers the exact commands, why it's preferable to Vercel preview deployments for mobile UI work, and the known caveats.

---

## Why

Sharity is a [sharing-economy app for Dalat](https://github.com/use-sharity/sharity) — Next.js 16 / Convex / Clerk / Tailwind. The mobile swipe-discover deck is the primary surface for first-time users, and it behaves differently enough between desktop Chrome and iOS Safari that desktop devtools lie to you:

- iOS safe-area insets
- WebKit's touch event idiosyncrasies
- Pull-to-refresh vs. body-scroll-lock
- iOS Safari's aggressive HTTPS caching

The only honest test is a real iPhone. The only fast honest test is a real iPhone hitting a local dev server.

---

## Stack

- **Mac:** `pnpm dev` on `localhost:3001`, `pnpm convex:dev` alongside.
- **Cloudflare Tunnel (`cloudflared`):** unauthenticated "quick tunnel" mode — one command, random public URL, HTTPS out of the box.
- **iPhone Safari:** opens the tunnel URL, runs Sharity against my Mac's dev server with hot reload working.
- **Claude Code on Mac, SSH'd from phone:** edit files by prompt; Next.js hot-reloads; Safari on the same phone shows the result.

One device is the dev terminal **and** the preview. Laptop stays at home.

---

## One-time install

```bash
brew install cloudflared
```

No login, no account. The quick-tunnel mode is anonymous; the URL is random and dies with the process.

---

## Daily workflow

```bash
# Terminal 1 — Sharity Next.js dev
pnpm dev                                    # binds to localhost:3001

# Terminal 2 — Convex dev (required for Sharity live queries)
pnpm convex:dev

# Terminal 3 — Cloudflare Tunnel
cloudflared tunnel --url http://localhost:3001
```

`cloudflared` prints a URL to stderr, e.g.:

```
https://jamie-becomes-resort-alto.trycloudflare.com
```

Open that on the iPhone (add `/en` or `/vi` for explicit locale). The app loads; Convex WebSockets keep live queries working through Cloudflare; hot reload pushes updates in ~1s.

Fresh URL every restart of `cloudflared`. For a stable subdomain, use a named tunnel (`cloudflared tunnel login` → `tunnel create`), but for a dev session a quick tunnel is enough.

---

## Why not the obvious alternatives

- **Vercel preview deployments:** every iteration needs `git push` + a build. Minutes, not seconds. Also doesn't surface local Convex data unless you also point at a dev deployment.
- **Local network (`192.168.x.x:3001`):** only works on the same Wi-Fi. Breaks the moment I'm out of the apartment or on guest Wi-Fi with AP isolation.
- **ngrok:** fine, but the free tier shows an interstitial warning page on every load and requires an account.
- **Tailscale:** great for "my devices only." Overkill when I want a teammate on another continent to open the link.

Cloudflare Tunnel quick mode is free, anonymous, and zero-friction.

---

## The phone-only loop with Claude Code

What really closes the loop is an **SSH terminal on the phone** into a Mac session where Claude Code is running. I use cmux (any `tmux`/`zellij` works) to keep the Claude session persistent, then connect from Termius / Blink / iSH.

- Tell Claude what to change — from the phone keyboard.
- Claude edits the file on the Mac.
- Next.js hot reload pushes the change through the tunnel.
- Safari on the same phone updates.
- Repeat.

I fixed the swipe-deck height clipping bug (card getting covered by the mobile tab bar on first load) entirely this way: from a café, laptop at home, prompt → fix → verify on the same phone → commit. No laptop needed in the loop.

---

## Sharity-specific caveats

- **Convex WebSockets through the tunnel:** work out of the box with `cloudflared`. If they ever don't, add the tunnel host to `allowedDevOrigins` in `next.config.ts`.
- **Clerk auth redirects:** OAuth redirect URIs need to include the tunnel URL if you want to log in on the phone. For quick UI testing, the existing session cookie from a prior login persists, so re-auth is often avoidable.
- **Locale routing:** the app uses `next-intl` with `/en`, `/vi`, `/ru`. Opening the bare tunnel URL redirects based on `Accept-Language`; append a locale explicitly if you want deterministic behavior (`/en`).
- **Cloudinary images:** load as normal — they're served from Cloudinary's CDN, not through the tunnel.
- **iOS Safari caching:** pull-to-refresh or Develop → Empty Cache (desktop Safari, phone connected via USB) when layout changes don't appear.

---

## Security caveats

- The tunnel URL is **public** while it's running. Anyone with the link hits my local dev server, which means my local Convex dev data, my Clerk test session, hot-reload source maps — everything. Don't paste it in a Telegram channel you don't control, kill the tunnel when done.
- Quick tunnels have no rate limiting. For anything you'll keep up for hours, pay for a named tunnel.

---

## Summary

Cloudflare Tunnel quick mode + Claude Code over SSH turns the iPhone into a complete dev workstation for Sharity — edit, reload, preview, commit, all from one device while the Mac sits at home doing the heavy lifting. Total friction: one `brew install`, three terminals, one public URL.
