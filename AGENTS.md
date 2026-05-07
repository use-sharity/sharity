<!-- claude2codex:begin -->
# PROJECT IDENTITY GUARD

This is the canonical active Sharity project:

```text
/Users/dmitrysurkov/Developer/Personal/sharity-vinhloc
```

If a prompt, worker packet, browser URL, handoff, or orchestrator metadata points
to `dalat-sharity`, treat that as stale/legacy unless the user explicitly says
to work on Dalat Sharity. For Sharity product work, code edits, dev servers, and
verification must happen in this repository.

For local app verification, treat Convex as required runtime infrastructure:
before browser or Playwright checks, confirm both `next dev` and `pnpm convex:dev`
are running from this repository. Do not treat a loaded Next.js page as a valid
Sharity check if the Convex dev process/database has not been verified.

## Two-User Browser Testing Guard

When testing Sharity flows that involve owner/requester, always use two browser
contexts that are explicitly signed in as different Clerk users. Do not assume a
window is authenticated just because a Playwright `storageState` file exists:
auth state is origin-specific, so localhost cookies/localStorage do not log in a
Cloudflare tunnel URL. For Cloudflare/iPhone testing, sign in on the tunnel
origin with `@clerk/testing/playwright` (`clerk.signIn`) for each user and wait
for `.cl-userButtonTrigger` before handing the windows to Dmitry. If old
Playwright Chrome windows are open, close the Chrome-for-Testing sessions first,
then open exactly two fresh windows.

Default test users:

- USER_A: `E2E_USER_A_EMAIL` / `user_38Te2S572G8xjj9FNCq8szncRAl`
- USER_B: `E2E_USER_B_EMAIL` / `user_38gb4lqLetM0bfE5ChI8DYn5ZLN`

# Sharity (Vinh Loc Edition)

Платформа для sharing economy — люди одалживают и находят вещи для временного использования.

## Концепция

**Проблема:** У людей есть вещи, которые редко используются, но могут быть полезны другим.

**Решение:** Платформа для временного шеринга вещей с системой заявок и календарём доступности.

## Tech Stack

- **Frontend:** Next.js 16 (App Router, React 19)
- **Backend:** Convex (serverless database + functions)
- **Auth:** Clerk (OAuth, passwordless)
- **Styling:** Tailwind CSS 4 + shadcn/ui
- **Package Manager:** pnpm
- **Language:** TypeScript 5

## Структура проекта

```
sharity-vinhloc/
├── app/                     # Next.js App Router
│   ├── page.tsx             # Главная (список вещей)
│   ├── layout.tsx           # Root layout (Clerk + Convex providers)
│   ├── globals.css          # Tailwind styles
│   └── ConvexClientProvider.tsx
├── components/              # React компоненты
│   ├── ui/                  # shadcn компоненты
│   │   ├── button.tsx
│   │   ├── calendar.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── file-upload.tsx
│   │   └── ...
│   ├── item-card.tsx        # Карточка вещи
│   ├── item-form.tsx        # Форма добавления/редактирования
│   ├── item-list.tsx        # Список вещей
│   ├── my-item-card.tsx     # Карточка своей вещи (с claims)
│   ├── my-items-list.tsx    # Список своих вещей
│   ├── claim-button.tsx     # Кнопка заявки
│   └── claim-item-back.tsx  # Возврат вещи
├── convex/                  # Convex backend
│   ├── schema.ts            # Database schema
│   ├── items.ts             # Queries & mutations
│   ├── auth.config.ts       # Clerk integration
│   └── _generated/          # Auto-generated types
├── hooks/                   # Custom hooks
│   ├── use-as-ref.ts
│   ├── use-isomorphic-layout-effect.ts
│   └── use-lazy-ref.ts
├── lib/                     # Утилиты
│   └── utils.ts             # cn() helper
├── public/                  # Статика
└── .claude/                 # Claude Code конфиг
    └── handoff/             # Handoff файлы
```

## Модель данных (Convex Schema)

### Item (Вещь)
```typescript
items: defineTable({
  name: v.string(),
  description: v.optional(v.string()),
  ownerId: v.string(),  // Clerk user ID
  imageStorageIds: v.optional(v.array(v.id("_storage"))),
})
```

### Claim (Заявка)
```typescript
claims: defineTable({
  itemId: v.id("items"),
  claimerId: v.string(),  // Clerk user ID
  status: v.union(
    v.literal("pending"),
    v.literal("approved"),
    v.literal("rejected"),
  ),
  startDate: v.number(),  // timestamp
  endDate: v.number(),    // timestamp
})
  .index("by_item", ["itemId"])
  .index("by_claimer", ["claimerId"])
```

## Convex Functions (convex/items.ts)

### Queries
- `get` — Получить все доступные вещи (исключая свои)
- `getMyItems` — Получить свои вещи + взятые на время
- `getClaims` — Получить заявки на вещь (только владелец)
- `getAvailability` — Получить занятые периоды для календаря

### Mutations
- `create` — Создать вещь
- `update` — Обновить вещь (только владелец)
- `deleteItem` — Удалить вещь (только владелец)
- `requestItem` — Создать заявку на вещь
- `approveClaim` — Одобрить заявку (только владелец)
- `rejectClaim` — Отклонить заявку (только владелец)
- `cancelClaim` — Отменить свою заявку
- `generateUploadUrl` — URL для загрузки изображений

## Команды

```bash
# Разработка
pnpm dev              # Запуск Next.js dev сервера
pnpm convex:dev       # Запуск Convex dev (в отдельном терминале)
# или: pnpm convex dev

# Сборка
pnpm build            # Production build
pnpm start            # Start production server

# Качество кода
pnpm lint             # ESLint
pnpm format           # Biome formatter

# Evals (Sharry AI assistant)
./scripts/run-evals.sh          # Run promptfoo evals (requires ANTHROPIC_API_KEY)
pnpm eval                       # Same via pnpm
pnpm eval:view                  # Run + open results web UI
```

## Environment Variables

```env
# Convex
CONVEX_DEPLOYMENT=            # team:project identifier
CONVEX_DEPLOYMENT_KEY=        # для production
NEXT_PUBLIC_CONVEX_URL=       # https://xxx.convex.cloud

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_ISSUER_URL=             # для Convex auth
```

## Authentication Flow

1. **Clerk** handles authentication (SignIn/SignUp modal)
2. **Convex** validates JWT tokens via `auth.config.ts`
3. User ID доступен через `ctx.auth.getUserIdentity().subject`

```typescript
// В Convex function
const identity = await ctx.auth.getUserIdentity();
if (!identity) throw new Error("Unauthenticated");
const userId = identity.subject;
```

## Key Patterns

### Convex + Clerk Setup
```tsx
// app/layout.tsx
<ClerkProvider>
  <ConvexClientProvider>
    {children}
  </ConvexClientProvider>
</ClerkProvider>
```

### Convex Client Provider
```tsx
// app/ConvexClientProvider.tsx
"use client";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth } from "@clerk/nextjs";
```

### Using Convex in Components
```tsx
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const items = useQuery(api.items.get);
const createItem = useMutation(api.items.create);
```

## Code Style (Vinhloc's Patterns)

### Форматирование
- **Formatter:** Biome (`pnpm format`)
- **Кавычки:** Двойные `"string"`
- **Точки с запятой:** Да, всегда
- **Отступы:** Tabs
- **Типы:** Строгий TypeScript, никаких `any`

### Naming Conventions

```typescript
// Файлы
ComponentName.tsx       // PascalCase для компонентов
kebab-case.tsx          // kebab-case для утилит
components/lease/       // kebab-case для папок

// Переменные и функции
const isFlipped = true;           // is* для boolean
const canRate = checkPermission(); // can* для проверок
const pickedUpAt = Date.now();    // *At для timestamps

// Типы
interface ItemCardProps { }       // *Props для props
type LeaseActivityEvent = { }     // PascalCase для типов

// Константы
const ONE_HOUR_MS = 3600000;      // UPPER_SNAKE_CASE
```

### Convex Functions Pattern

```typescript
export const functionName = mutation({
  args: { id: v.id("items") },
  handler: async (ctx, args) => {
    // 1. Auth check
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // 2. Fetch data
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found");

    // 3. Authorization
    if (item.ownerId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    // 4. Business logic + activity trail
    await ctx.db.insert("item_activity", {
      itemId: args.id,
      type: "item_updated",
      actorId: identity.subject,
      createdAt: Date.now(),
    });

    // 5. Return result
    return { success: true };
  },
});
```

### React Component Pattern

```typescript
"use client";

import { useMutation, useQuery } from "convex/react";
import { useState, useCallback, useMemo } from "react";

interface ComponentProps {
  item: Doc<"items">;
}

export function ComponentName({ item }: ComponentProps) {
  // 1. Hooks at top
  const [isLoading, setIsLoading] = useState(false);
  const data = useQuery(api.items.get);
  const mutate = useMutation(api.items.update);

  // 2. Derived state with useMemo
  const canEdit = useMemo(() => /* ... */, [deps]);

  // 3. Handlers with useCallback
  const handleClick = useCallback(async () => {
    setIsLoading(true);
    try {
      await mutate({ id: item._id });
    } finally {
      setIsLoading(false);
    }
  }, [mutate, item._id]);

  // 4. Early returns for guards
  if (!data) return <Loading />;

  // 5. JSX
  return <div>...</div>;
}
```

### Activity Trail Pattern

Каждая мутация создаёт запись в activity таблице — это source of truth:

```typescript
// В mutation
await ctx.db.insert("lease_activity", {
  itemId: args.itemId,
  claimId: claim._id,
  type: "lease_approved",
  actorId: identity.subject,
  createdAt: Date.now(),
});

// В компоненте — derive state from events
const status = useMemo(() => {
  const lastEvent = leaseEvents[leaseEvents.length - 1];
  return lastEvent?.type ?? "pending";
}, [leaseEvents]);
```

### Import Order

```typescript
// 1. External dependencies
import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import { Check, X } from "lucide-react";

// 2. Types
import type { Doc, Id } from "@/convex/_generated/dataModel";

// 3. UI components
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// 4. Custom components
import { ItemCard } from "@/components/item-card";

// 5. Utilities
import { cn } from "@/lib/utils";
```

### Commit Messages

```
type(scope): description

feat(items): add calendar system
fix(auth): restore env var for Convex
chore(deps): update pnpm lockfile
style(items): relayout the item detail page
docs(todos): check off location
```

### Git Workflow

**IMPORTANT: Check formatting after committing!**

The project uses Biome formatter with a pre-commit hook. After committing:
1. Formatter automatically runs and may modify files
2. Check `git status` — if there are changes, add them and run `git commit --amend --no-edit`
3. Repeat until `git status` shows "working tree clean"

```bash
# After committing
git status
# If there are changes from formatter:
git add <modified_files>
git commit --amend --no-edit
# Repeat until working tree clean
```

---

## MVP Features

- [x] Список вещей с изображениями
- [x] Добавление/редактирование вещей
- [x] Загрузка изображений (Convex Storage)
- [x] Система заявок (request/approve/reject)
- [x] Календарь доступности
- [x] Мои вещи / Взятые вещи

## Claims Flow

1. User requests item с выбором дат
2. Owner видит pending claims в карточке
3. Owner approves/rejects claim
4. При approve — даты блокируются в календаре
5. Claimer видит вещь в "My Items" как borrowed

## Business Rules

- Максимум 5 pending claims на одну вещь
- Нельзя запросить свою вещь
- Даты approved claims не могут пересекаться
- Только owner может approve/reject claims
- Только claimer может отменить свою заявку

## Email Templates (i18n)

All outbound emails support `en`, `vi`, and `ru` via a Convex-side dictionary — `next-intl` is unavailable in Convex Node actions.

### Where strings live

All translatable copy lives in `convex/emailTemplates/i18n.ts`. Each key appears once per locale:

```typescript
const emailStrings: Record<Locale, Record<string, string>> = {
  en: { "welcome.subject": "Welcome to Sharity!", ... },
  vi: { "welcome.subject": "Chào mừng bạn đến với Sharity!", ... },
  ru: { "welcome.subject": "Добро пожаловать в Sharity!", ... },
};
```

### Adding a new email

1. Add all string keys to `emailStrings` in `i18n.ts` for all 3 locales.
2. Create a template in `convex/emailTemplates/yourEmail.tsx`. The template **must** accept `locale: Locale` and pass it to `SharityEmail`.
3. Use `t(locale, "key", { param: value })` for all copy; `formatDateLocalized(ts, locale)` / `formatWindowLocalized(start, end, locale)` for dates.
4. Add `locale: localeValidator` arg to the action in `emailSend.ts`; use `t(locale, "key")` for the subject.
5. At the scheduler call site, pass `locale: user.profile.locale`.

### Pattern example

```typescript
// emailTemplates/myEmail.tsx
export function MyEmail({ name, locale }: { name: string; locale: Locale }) {
  return (
    <SharityEmail preview={t(locale, "myEmail.preview", { name })} locale={locale}>
      <Text>{t(locale, "myEmail.heading", { name })}</Text>
    </SharityEmail>
  );
}

// emailSend.ts action
export const sendMyEmail = internalAction({
  args: { email: v.string(), name: v.string(), locale: localeValidator },
  handler: async (ctx, args) => {
    const locale = resolveLocale(args.locale);
    await sendMail(ctx, args.email, t(locale, "myEmail.subject"),
      React.createElement(MyEmail, { name: args.name, locale }));
  },
});

// Call site in items.ts
await ctx.scheduler.runAfter(0, internal.emailSend.sendMyEmail, {
  email: user.email,
  name: user.name,
  locale: user.profile.locale,   // ← always pass locale from user record
});
```

### Rules
- `SharityEmail` **requires** `locale` — TypeScript will catch new templates that omit it.
- Missing keys fall back to English automatically.
- For plurals in Russian use `t()` with `"singular|few|many"` format + `pluralize()`.

## Leaflet Maps (react-leaflet)

### ВАЖНО: Tailwind CSS 4 ломает Leaflet tiles!

При использовании Leaflet с Tailwind CSS 4 обязательно добавь в `globals.css`:

```css
/* Fix Leaflet tiles broken by Tailwind CSS reset */
.leaflet-container {
  width: 100%;
  height: 100%;
}

.leaflet-tile,
.leaflet-marker-icon,
.leaflet-marker-shadow {
  max-width: none !important;
  max-height: none !important;
}

.leaflet-tile-pane img {
  max-width: none !important;
  max-height: none !important;
}

.leaflet-pane {
  z-index: 400;
}

.leaflet-control {
  z-index: 800;
}
```

### Dynamic Import (обязательно!)

Leaflet не работает с SSR. Всегда используй dynamic import:

```tsx
// В компоненте который использует карту
import dynamic from "next/dynamic";

const ItemsMap = dynamic(
  () => import("./items-map").then((mod) => mod.ItemsMap),
  {
    ssr: false,
    loading: () => <div className="h-[400px] bg-gray-100">Loading map...</div>,
  }
);
```

### InvalidateSize

Если карта рендерится неправильно (tiles не на своих местах), добавь компонент:

```tsx
function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100);
  }, [map]);
  return null;
}

// Внутри MapContainer
<MapContainer>
  <InvalidateSize />
  <TileLayer ... />
</MapContainer>
```

### Leaflet CSS Import

В `globals.css` импортируй Leaflet CSS:
```css
@import "leaflet/dist/leaflet.css";
```

### Структура компонента карты

См. `components/items-map.tsx` — пример с dynamic import внутри компонента для SSR-совместимости.

---

## Документация проекта

### Obsidian (офлайн)

Документация синхронизируется в Obsidian vault для офлайн-доступа:

```
/Users/dmitrysurkov/Library/Mobile Documents/iCloud~md~obsidian/Documents/Main/02-Projects/Sharity/
├── README.md           # Обзор проекта
├── Notion/             # Страницы из Notion
├── Design/             # Figma дизайн
└── Architecture/       # Miro схемы
```

### Внешние источники

| Source | URL |
|--------|-----|
| Notion | https://www.notion.so/Sharity-Dalat-Build-Week-2e60a5be7bbe80e68b23f1f5f158aaee |
| Miro | https://miro.com/app/board/uXjVGPKWI70=/ |
| Figma | https://figma.com/design/S74LV4AyyLLK7L2G5Y211m/Sharity?node-id=2004-4099 |

### Синхронизация

```bash
# Синхронизировать всё
python scripts/sync_docs.py --all

# Только один источник
python scripts/sync_docs.py --notion
python scripts/sync_docs.py --miro
python scripts/sync_docs.py --figma

# Статус кэша
python scripts/sync_docs.py --status

# Принудительное обновление
python scripts/sync_docs.py --all --force
```

### API Setup

Для полной синхронизации создать `.env` файл:

```env
NOTION_TOKEN=secret_xxx...
MIRO_ACCESS_TOKEN=xxx...
FIGMA_ACCESS_TOKEN=figd_xxx...
```

**ВАЖНО**: `.env` не коммитится (в `.gitignore`)

---

*Последнее обновление: 2026-01-23*

---

## Codex Context System

This repository also carries Codex-native context, scoped for fair long-running work and Claude Code vs Codex benchmarks.

- Repo skills live in `.agents/skills/` and use Codex progressive disclosure.
- Start substantial tasks with `sharity-context`.
- Use `sharity-convex` for `convex/` work.
- Use `sharity-react` for app routes/components/i18n.
- Use `sharity-playwright` for browser, Playwright, Clerk E2E, screenshot, and mobile-flow verification.
- Use `sharity-benchmark` for side-by-side Claude/Codex runs.
- Use `sharity-memory` after substantial work or context audits to preserve reusable learnings in focused context/skills.
- Compact context notes live in `.codex/context/`.
- Benchmark prompts and run artifacts live in `.codex/benchmarks/`.
- Memory audit reports live in `.codex/memory/`; run `pnpm memory:audit` to detect likely context drift.

Do not rely only on TypeScript checks for UI features. For user-facing flows, run or explicitly attempt Playwright/browser verification and save evidence when benchmarking.

<!-- claude2codex:end -->
