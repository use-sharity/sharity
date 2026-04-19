# Phone-only development with Cloudflare Tunnel + Claude Code

Develop on your iPhone, preview on the same iPhone. Your Mac dev server stays local (no deployment, no build pipeline), but a public HTTPS URL exposes it to the phone's Safari / any teammate's browser.

This is what I used to test Sharity's mobile swipe deck without a single `git push`.

---

## Stack

- **Mac:** Next.js dev server on `localhost:3001`, Convex dev running alongside.
- **Cloudflare Tunnel (`cloudflared`):** ephemeral tunnel, no account, no DNS config — one command prints a public `*.trycloudflare.com` URL.
- **iPhone Safari:** opens the tunnel URL, runs the app against the local dev server with hot reload working through the tunnel.
- **Claude Code (remote session on the phone):** edit the code from the same iPhone over an SSH-backed session; Claude applies the change on the Mac, Next.js hot-reloads, Safari on the phone shows the update in seconds.

Result: the phone is the development terminal **and** the preview device. One device, full loop.

---

## One-time install

```bash
brew install cloudflared
```

That's it. No login, no account. The "quick tunnel" mode is unauthenticated, URL is random and lives until you kill the process.

---

## Daily workflow

```bash
# Terminal 1 — Next.js dev server
pnpm dev   # binds to localhost:3001

# Terminal 2 — Convex dev (if your stack uses it)
pnpm convex:dev

# Terminal 3 — Cloudflare Tunnel
cloudflared tunnel --url http://localhost:3001
```

`cloudflared` prints a URL to stderr, looking like:

```
https://jamie-becomes-resort-alto.trycloudflare.com
```

Open that on the iPhone. Safari loads your Mac's dev server through Cloudflare's edge. Hot reload works. Convex websockets work (Cloudflare proxies them). Safe-area insets, touch events, iOS Safari quirks — all real, because you're actually on a real phone.

The URL changes every time you restart `cloudflared`. If that's annoying, pay for a named tunnel (`cloudflared tunnel login` → `cloudflared tunnel create`) and you get a stable subdomain.

---

## Why this beats the usual alternatives

- **Vercel / Netlify preview deployments:** require a git push, a build, env-var setup for every PR. Minutes per iteration vs. seconds.
- **Local network (`192.168.x.x:3001`):** only works if phone and laptop are on the same Wi-Fi; corporate / guest Wi-Fi often blocks peer-to-peer.
- **ngrok:** fine, but adds a warning interstitial on the free tier, and you still need an account. Cloudflare Tunnel quick mode is zero-friction.
- **Tailscale:** great for "your devices only," overkill when you want to share with a teammate.

Cloudflare Tunnel is free, anonymous, and just works.

---

## The phone-only loop with Claude Code

What closes the loop is having an **SSH terminal open on the phone** into a Mac session where Claude Code is running. I use [cmux](https://github.com/rjwithers/cmux) (any `tmux` / `zellij` setup works) to keep the Claude session persistent, then connect from iSH / Termius / Blink.

- Tell Claude what to change — right from the phone keyboard.
- Claude edits the file on the Mac.
- Next.js hot reload pushes the change through the tunnel.
- Safari on the same phone updates.
- Repeat.

The laptop stays at home, running the dev server and the Claude session. You're on the go with just the phone. No `git pull` loop, no redeploy — a mobile layout bug can be fixed from a café while the laptop is a hundred kilometers away.

---

## Caveats

- The tunnel URL is public while it's running — anyone with the link hits your local dev server. Don't paste it anywhere persistent, kill the tunnel when you're done.
- Hot reload websockets: Cloudflare proxies them, but some setups need `allowedDevOrigins` in `next.config`. If HMR doesn't work, add the tunnel host there.
- iOS Safari caches aggressively over HTTPS. Pull-to-refresh or Develop → Empty Cache from desktop Safari when things look stale.
- Quick tunnels have no rate-limit protection. For an actual demo or staging URL, set up a named tunnel.

---

## Public URL used for this session

```
https://jamie-becomes-resort-alto.trycloudflare.com/en
```

(Ephemeral. Gone after the laptop restarts.)
