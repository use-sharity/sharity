This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Toolchain

- [Next.js](https://nextjs.org)
- [Tailwind CSS](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com)
- [Convex](https://convex.dev)
- [pnpm](https://pnpm.io)

## Getting Started

First, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Roadmap

### 🎁 Item Management
- [x] Submit an item for sharing
- [~] Manage owned items:
    - [x] View pending and approved requests
    - [x] Set unavailability periods (calendar blocking)
    - [ ] Set a fixed rental price (optional, cannot be changed once set)
    - [ ] Set a deposit amount (optional)
- [x] Approve or reject claims:
    - [x] Manage queue of claimants (limit to 5)
    - [x] Provide rejection reasons (optional)
- [x] Manage borrowed items & owned items
- [x] Show "Past Due" status for stale requests
- [x] Visualize item journey (activity timeline)
- [ ] Mark items as exchanged (hides from market)
- [~] Status badges for items (owner-side: available, pending, approved, picked up, returned, expired)

### 🔍 Discovery & Search
- [x] Browse items for discovery
- [~] Search for items:
    - [x] By location
    - [x] By keyword (client-side filtering)
    - [ ] By availability time
    - [ ] By deposit/price requirements
    - [ ] By owner (exclude own items from browse)
    - [ ] Semantic search (beyond keyword) [#12](https://github.com/JenyaBogacheva/sharity-dalat/issues/12)
- [x] Claim/Request an item:
    - [x] Specify pick-up time
    - [x] Specify return time
- [x] Request non-existent items (wishlist)

### 💰 Payments & Logistics
- [ ] Selling / Buying flow (no integrated payments) [#11](https://github.com/JenyaBogacheva/sharity-dalat/issues/11)
- [ ] Deposit (for valuable items) [#19](https://github.com/JenyaBogacheva/sharity-dalat/issues/19)
- [ ] Payments (integrated) [#16](https://github.com/JenyaBogacheva/sharity-dalat/issues/16)
- [ ] Delivery via Grab [#15](https://github.com/JenyaBogacheva/sharity-dalat/issues/15)

### 💬 Communication & Support
- [x] Show contact details after exchange approval
- [ ] Chat (in-app) [#17](https://github.com/JenyaBogacheva/sharity-dalat/issues/17)
- [x] Email notifications + Email as contact method [#21](https://github.com/JenyaBogacheva/sharity-dalat/issues/21)
- [x] Support bot [#29](https://github.com/JenyaBogacheva/sharity-dalat/issues/29)

### 🛡️ Trust & Safety
- [ ] Block specific users from claiming items
- [ ] Dispute handling [#20](https://github.com/JenyaBogacheva/sharity-dalat/issues/20)
- [ ] Gamification [#18](https://github.com/JenyaBogacheva/sharity-dalat/issues/18)

### 🌍 Localization
- [x] i18n infrastructure (next-intl, locale routing)
- [x] English
- [x] Russian
- [x] Vietnamese
    
## Deployment

This repo is connected to https://sharity-dalat.vercel.app with auto-deployments on changes to `main` branch.`