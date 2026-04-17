# Analytics — PMF Tracking

Sharity is a two-sided sharing marketplace. PMF signal = **the sharing loop spins on its own**.

```
Owner lists → Borrower requests → Owner approves → Physical handoff → Return → Repeat
```

We track 3 events that cover the entire loop. From them we derive 4 metrics that prove (or disprove) PMF.

---

## Tracked Events

All events are captured via PostHog client. Definitions live in [`lib/posthog/events.ts`](lib/posthog/events.ts).

### `item_listed`

Fired when an owner successfully creates a new item.

| Property | Type | Description |
|----------|------|-------------|
| `item_id` | `string` | Convex item ID |
| `has_images` | `boolean` | Whether images were uploaded |
| `mode` | `"lease" \| "giveaway"` | Sharing mode |

**Call site:** [`components/add-item-form.tsx`](components/add-item-form.tsx) — after `createItem` succeeds.

---

### `claim_requested`

Fired when a borrower submits a request for an item.

| Property | Type | Description |
|----------|------|-------------|
| `item_id` | `string` | Convex item ID |
| `duration_days` | `number` | Requested borrow duration in days |

**Call sites:** [`hooks/use-claim-item.ts`](hooks/use-claim-item.ts) — after `requestItem` succeeds (both date-picker and intraday paths).

---

### `exchange_completed`

Fired when a pickup is confirmed (item physically handed over).

| Property | Type | Description |
|----------|------|-------------|
| `item_id` | `string` | Convex item ID |
| `claim_id` | `string` | Convex claim ID |
| `is_giveaway` | `boolean` | True if item is being given away (no return) |
| `days_since_approval` | `number` | Days between claim approval and pickup |

**Call site:** [`hooks/use-tracked-pickup.ts`](hooks/use-tracked-pickup.ts) — wraps `markPickedUp` mutation. Used in:
- [`app/[locale]/item/[id]/page.tsx`](app/%5Blocale%5D/item/%5Bid%5D/page.tsx)
- [`components/lease/borrower-request-panel.tsx`](components/lease/borrower-request-panel.tsx)
- [`components/notifications/notification-feed.tsx`](components/notifications/notification-feed.tsx)

`isGiveaway` and `approvedAt` are passed from [`components/lease/lease-claim-card.tsx`](components/lease/lease-claim-card.tsx) where the claim context is available.

---

## PMF Metrics

### 1. Successful Exchange Rate

```
exchange_completed count / claim_requested count (rolling 30d)
```

Single number spanning the full funnel. High = approval, logistics, and trust all work.

**PostHog:** Funnel insight — `claim_requested` → `exchange_completed`. Group by week.

---

### 2. Supply Activation Rate

```
unique item_id on claim_requested / unique item_id on item_listed (rolling 30d)
```

Dead supply = no marketplace. Catches "list and forget" problem.

**PostHog:** Two trend insights (unique property count on `item_id`); divide in the dashboard.

---

### 3. Repeat Usage Rate

```
users with 2+ exchange_completed / users with 1+ exchange_completed (rolling 30d)
```

One exchange = curiosity. Two = habit. This IS PMF.

**PostHog:** Lifecycle insight on `exchange_completed`; filter for "returning" users.

---

### 4. Time to First Exchange

```
median(first exchange_completed timestamp − first $identify timestamp)
```

Activation speed. Long = churn before value. Short = product clicks.

**PostHog:** User path or custom formula using person's first `$identify` vs first `exchange_completed`.

---

## PostHog Setup

1. Go to **Insights** → **New insight**
2. Build each metric as described above
3. Pin all 4 to a **PMF Dashboard**
4. Set dashboard to refresh weekly

PostHog init is in [`instrumentation-client.ts`](instrumentation-client.ts).
User identity (Clerk ID + email) is set in [`components/posthog-identify.tsx`](components/posthog-identify.tsx).

---

## Adding New Events

1. Add the event name to the `EVENTS` const in [`lib/posthog/events.ts`](lib/posthog/events.ts) — this is the canonical source of truth for all event name strings. Never inline event name strings in `posthog.capture()` calls.
2. Add a props type and a `trackXxx` function in the same file, using `EVENTS.YOUR_EVENT` in the `capture` call.
3. Call `trackXxx(...)` at the mutation success point in the relevant hook or component.
4. If the tracker needs to wrap a `useMutation`, follow the pattern in [`hooks/use-tracked-pickup.ts`](hooks/use-tracked-pickup.ts): keep the analytics args type local (unexported), and wrap the returned function in `useCallback` so the reference is stable across renders.
5. Document the new event here.

Keep event names `snake_case`. Properties `snake_case`. No PII beyond what PostHog already captures via identify.

### Key files

| File | Role |
|------|------|
| [`lib/posthog/events.ts`](lib/posthog/events.ts) | `EVENTS` const, `ONE_DAY_MS`, typed capture functions |
| [`hooks/use-tracked-pickup.ts`](hooks/use-tracked-pickup.ts) | Pattern for wrapping a mutation with tracking; `TrackedPickupArgs` is local here, not exported |
| [`hooks/use-claim-item.ts`](hooks/use-claim-item.ts) | `claim_requested` tracking after `requestItem` |
| [`components/add-item-form.tsx`](components/add-item-form.tsx) | `item_listed` tracking after `createItem` |
