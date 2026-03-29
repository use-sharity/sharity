# Enhanced Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified calendar view showing all user lending, borrowing, and vacation activity with an "Up Next" action summary, event detail popovers, and Google Calendar / .ics export.

**Architecture:** FullCalendar month grid with custom event rendering, fed by a single Convex query that aggregates claims + owner_unavailability. Vacation creation via drag-select on the calendar. Client-side export (Google Calendar URL + .ics file generation).

**Tech Stack:** FullCalendar (`@fullcalendar/react`, `@fullcalendar/daygrid`, `@fullcalendar/interaction`), Convex queries, shadcn/ui Popover, next/dynamic for SSR bypass, date-fns for formatting.

---

## File Structure

```
components/
├── calendar/
│   ├── enhanced-calendar.tsx          # Main orchestrator (FullCalendar + UpNext + VacationDialog)
│   ├── up-next-section.tsx            # "Up Next" action cards
│   ├── calendar-event-popover.tsx     # Event detail popover
│   └── calendar-export-utils.ts       # Google Cal URL + .ics generation
├── owner-unavailability-button.tsx    # Modified: extract dialog, accept initial dates
convex/
└── items.ts                           # New: getCalendarEvents query
```

---

### Task 1: Install FullCalendar dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
cd /Users/eugenia_bogacheva/PersonalProjects/sharity/.worktrees/enhanced-calendar
pnpm add @fullcalendar/react @fullcalendar/daygrid @fullcalendar/interaction @fullcalendar/core
```

- [ ] **Step 2: Verify installation**

```bash
ls node_modules/@fullcalendar/react/package.json && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): add FullCalendar packages for enhanced calendar"
```

---

### Task 2: Calendar export utilities

**Files:**
- Create: `components/calendar/calendar-export-utils.ts`

- [ ] **Step 1: Create the export utils file**

This file provides two pure functions — no React, no side effects, easily testable.

```typescript
// components/calendar/calendar-export-utils.ts

import { format } from "date-fns";

/**
 * Build a Google Calendar "create event" URL.
 *
 * Timed events use the format `YYYYMMDDTHHmmss` (local),
 * all-day events use `YYYYMMDD` (Google treats these as full-day).
 */
export function buildGoogleCalendarUrl(event: {
	title: string;
	startDate: number;
	endDate: number;
	isAllDay: boolean;
	description?: string;
}): string {
	const base = "https://calendar.google.com/calendar/render";
	const params = new URLSearchParams({ action: "TEMPLATE" });

	params.set("text", event.title);

	if (event.isAllDay) {
		// Google Calendar all-day format: YYYYMMDD
		// End date must be the NEXT day (exclusive end)
		const start = format(new Date(event.startDate), "yyyyMMdd");
		const endPlusOne = new Date(event.endDate);
		endPlusOne.setDate(endPlusOne.getDate() + 1);
		const end = format(endPlusOne, "yyyyMMdd");
		params.set("dates", `${start}/${end}`);
	} else {
		const start = format(new Date(event.startDate), "yyyyMMdd'T'HHmmss");
		const end = format(new Date(event.endDate), "yyyyMMdd'T'HHmmss");
		params.set("dates", `${start}/${end}`);
	}

	if (event.description) {
		params.set("details", event.description);
	}

	return `${base}?${params.toString()}`;
}

/**
 * Generate an iCalendar (.ics) string and trigger a browser download.
 */
export function downloadIcsFile(event: {
	title: string;
	startDate: number;
	endDate: number;
	isAllDay: boolean;
	description?: string;
}): void {
	const uid = `${event.startDate}-${event.title.replace(/\s+/g, "")}@sharity`;

	let dtstart: string;
	let dtend: string;

	if (event.isAllDay) {
		dtstart = `DTSTART;VALUE=DATE:${format(new Date(event.startDate), "yyyyMMdd")}`;
		const endPlusOne = new Date(event.endDate);
		endPlusOne.setDate(endPlusOne.getDate() + 1);
		dtend = `DTEND;VALUE=DATE:${format(endPlusOne, "yyyyMMdd")}`;
	} else {
		dtstart = `DTSTART:${format(new Date(event.startDate), "yyyyMMdd'T'HHmmss")}`;
		dtend = `DTEND:${format(new Date(event.endDate), "yyyyMMdd'T'HHmmss")}`;
	}

	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Sharity//EN",
		"BEGIN:VEVENT",
		`UID:${uid}`,
		dtstart,
		dtend,
		`SUMMARY:${event.title}`,
		event.description ? `DESCRIPTION:${event.description.replace(/\n/g, "\\n")}` : "",
		"END:VEVENT",
		"END:VCALENDAR",
	]
		.filter(Boolean)
		.join("\r\n");

	const blob = new Blob([lines], { type: "text/calendar;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `${event.title.replace(/[^a-zA-Z0-9]/g, "_")}.ics`;
	a.click();
	URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Commit**

```bash
git add components/calendar/calendar-export-utils.ts
git commit -m "feat(calendar): add Google Calendar URL and .ics export utilities"
```

---

### Task 3: Convex `getCalendarEvents` query

**Files:**
- Modify: `convex/items.ts`

This query aggregates claims (lending + borrowing) and owner_unavailability into a flat event list. It resolves counterparty names, pickup/return times from lease_activity, and action state from journey logic.

- [ ] **Step 1: Add the `getCalendarEvents` query to `convex/items.ts`**

Add this at the end of the file, before any closing braces. The query needs to:
1. Get the current user's ID
2. Fetch all claims where the user is owner or claimer, filtered by the visible date range
3. Fetch owner_unavailability ranges for the user in the visible date range
4. For each claim, look up the latest lease_activity events to determine pickup/return times and journey state
5. Resolve counterparty names from the `users` table
6. Determine `needsAction` based on the current journey step

```typescript
export const getCalendarEvents = query({
	args: {
		startDate: v.number(),
		endDate: v.number(),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return [];

		const userId = identity.subject;
		const results: Array<{
			id: string;
			type: "lending" | "borrowing" | "vacation";
			title: string;
			startDate: number;
			endDate: number;
			isAllDay: boolean;
			itemId?: string;
			claimId?: string;
			needsAction?: "respond" | "schedule" | "confirm" | null;
			counterpartyName?: string;
			vacationNote?: string;
		}> = [];

		// --- 1. Claims where user is the item owner (lending) ---
		const ownedItems = await ctx.db
			.query("items")
			.filter((q) => q.eq(q.field("ownerId"), userId))
			.collect();

		for (const item of ownedItems) {
			const claims = await ctx.db
				.query("claims")
				.withIndex("by_item", (q) => q.eq("itemId", item._id))
				.collect();

			for (const claim of claims) {
				// Skip rejected, returned, transferred, expired, missing claims
				if (claim.rejectedAt || claim.returnedAt || claim.transferredAt || claim.expiredAt || claim.missingAt) continue;
				// Skip claims outside the visible range
				if (claim.endDate < args.startDate || claim.startDate > args.endDate) continue;

				// Fetch lease activity for time resolution and journey state
				const events = await ctx.db
					.query("lease_activity")
					.withIndex("by_claim_createdAt", (q) => q.eq("claimId", claim._id))
					.collect();

				// Resolve counterparty name
				const borrowerProfile = await ctx.db
					.query("users")
					.withIndex("by_clerk_id", (q) => q.eq("clerkId", claim.claimerId))
					.first();

				// Determine pickup/return times from lease_activity events
				const pickupEvent = events.find(
					(e) => e.type === "lease_pickup_approved" || e.type === "lease_pickup_proposed",
				);
				const returnEvent = events.find(
					(e) => e.type === "lease_return_approved" || e.type === "lease_return_proposed",
				);

				let eventStart = claim.startDate;
				let eventEnd = claim.endDate;
				let isAllDay = true;

				if (pickupEvent?.windowStartAt) {
					eventStart = pickupEvent.windowStartAt;
					isAllDay = false;
				}
				if (claim.pickedUpAt && !pickupEvent?.windowStartAt) {
					eventStart = claim.pickedUpAt;
					isAllDay = false;
				}
				if (returnEvent?.windowEndAt) {
					eventEnd = returnEvent.windowEndAt;
					isAllDay = false;
				}

				// Determine needsAction
				const needsAction = resolveNeedsAction(claim, events, "owner");

				const borrowerName = borrowerProfile?.name || "Someone";
				results.push({
					id: claim._id,
					type: "lending",
					title: `${item.name} → ${borrowerName}`,
					startDate: eventStart,
					endDate: eventEnd,
					isAllDay,
					itemId: item._id,
					claimId: claim._id,
					needsAction,
					counterpartyName: borrowerName,
				});
			}
		}

		// --- 2. Claims where user is claimer (borrowing) ---
		const borrowedClaims = await ctx.db
			.query("claims")
			.withIndex("by_claimer", (q) => q.eq("claimerId", userId))
			.collect();

		for (const claim of borrowedClaims) {
			if (claim.rejectedAt || claim.returnedAt || claim.transferredAt || claim.expiredAt || claim.missingAt) continue;
			if (claim.endDate < args.startDate || claim.startDate > args.endDate) continue;

			const item = await ctx.db.get(claim.itemId);
			if (!item) continue;

			const events = await ctx.db
				.query("lease_activity")
				.withIndex("by_claim_createdAt", (q) => q.eq("claimId", claim._id))
				.collect();

			const ownerProfile = await ctx.db
				.query("users")
				.withIndex("by_clerk_id", (q) => q.eq("clerkId", item.ownerId))
				.first();

			const pickupEvent = events.find(
				(e) => e.type === "lease_pickup_approved" || e.type === "lease_pickup_proposed",
			);
			const returnEvent = events.find(
				(e) => e.type === "lease_return_approved" || e.type === "lease_return_proposed",
			);

			let eventStart = claim.startDate;
			let eventEnd = claim.endDate;
			let isAllDay = true;

			if (pickupEvent?.windowStartAt) {
				eventStart = pickupEvent.windowStartAt;
				isAllDay = false;
			}
			if (claim.pickedUpAt && !pickupEvent?.windowStartAt) {
				eventStart = claim.pickedUpAt;
				isAllDay = false;
			}
			if (returnEvent?.windowEndAt) {
				eventEnd = returnEvent.windowEndAt;
				isAllDay = false;
			}

			const needsAction = resolveNeedsAction(claim, events, "borrower");

			const ownerName = ownerProfile?.name || "Someone";
			results.push({
				id: claim._id,
				type: "borrowing",
				title: `${item.name} ← ${ownerName}`,
				startDate: eventStart,
				endDate: eventEnd,
				isAllDay,
				itemId: item._id,
				claimId: claim._id,
				needsAction,
				counterpartyName: ownerName,
			});
		}

		// --- 3. Owner unavailability (vacation) ---
		const unavailability = await ctx.db
			.query("owner_unavailability")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.collect();

		for (const range of unavailability) {
			if (range.endDate < args.startDate || range.startDate > args.endDate) continue;
			results.push({
				id: range._id,
				type: "vacation",
				title: "Vacation",
				startDate: range.startDate,
				endDate: range.endDate,
				isAllDay: true,
				vacationNote: range.note,
			});
		}

		return results;
	},
});

/**
 * Determine what action the viewer needs to take on a claim.
 * Returns null if no action is needed from this viewer.
 */
function resolveNeedsAction(
	claim: {
		status: string;
		approvedAt?: number;
		pickedUpAt?: number;
	},
	events: Array<{ type: string; actorId: string }>,
	viewerRole: "owner" | "borrower",
): "respond" | "schedule" | "confirm" | null {
	const eventTypes = new Set(events.map((e) => e.type));

	// Pending — only owner responds
	if (claim.status === "pending") {
		return viewerRole === "owner" ? "respond" : null;
	}

	// Not yet approved — no action
	if (!claim.approvedAt) return null;

	// Check pickup phase
	if (!claim.pickedUpAt) {
		if (!eventTypes.has("lease_pickup_proposed")) {
			return "schedule"; // either side can propose
		}
		if (!eventTypes.has("lease_pickup_approved")) {
			return "respond"; // counterpart approves
		}
		return "confirm"; // pickup approved, needs confirmation
	}

	// Check return phase (item is picked up)
	if (!eventTypes.has("lease_return_proposed")) {
		return "schedule";
	}
	if (!eventTypes.has("lease_return_approved")) {
		return "respond";
	}
	return "confirm"; // return approved, needs confirmation
}
```

- [ ] **Step 2: Verify Convex compiles**

```bash
cd /Users/eugenia_bogacheva/PersonalProjects/sharity/.worktrees/enhanced-calendar
npx convex dev --once 2>&1 | tail -20
```

Expected: No errors related to `getCalendarEvents`.

- [ ] **Step 3: Commit**

```bash
git add convex/items.ts
git commit -m "feat(calendar): add getCalendarEvents Convex query"
```

---

### Task 4: Extract vacation dialog from `OwnerUnavailabilityButton`

**Files:**
- Modify: `components/owner-unavailability-button.tsx`

Refactor the existing component to accept optional `initialStartDate` and `initialEndDate` props so the calendar can open it with pre-filled dates. The dialog content stays inline — just add props and wire them up.

- [ ] **Step 1: Add props for initial dates and external open control**

Add `initialStartDate` and `initialEndDate` to the props interface:

```typescript
interface OwnerUnavailabilityButtonProps {
	className?: string;
	variant?: ComponentProps<typeof Button>["variant"];
	size?: ComponentProps<typeof Button>["size"];
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	/** Pre-fill the date range picker (e.g. from calendar drag-select) */
	initialStartDate?: Date;
	initialEndDate?: Date;
	/** If true, render only the dialog (no trigger button) */
	dialogOnly?: boolean;
}
```

- [ ] **Step 2: Wire up the initial dates in the component body**

After the existing `useState` for `date`, add an effect to sync initial dates:

```typescript
// Inside the component, after: const [date, setDate] = React.useState<DateRange | undefined>(undefined);
React.useEffect(() => {
	if (props.initialStartDate && props.initialEndDate) {
		setDate({ from: props.initialStartDate, to: props.initialEndDate });
	}
}, [props.initialStartDate, props.initialEndDate]);
```

- [ ] **Step 3: Support `dialogOnly` mode**

Wrap the return with a conditional — when `dialogOnly` is true, render the Dialog without the DialogTrigger button:

```typescript
if (props.dialogOnly) {
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent className="sm:max-w-xl">
				{/* ... same dialog content as before ... */}
			</DialogContent>
		</Dialog>
	);
}

// Existing return with DialogTrigger stays as-is
return (
	<Dialog open={open} onOpenChange={setOpen}>
		<DialogTrigger asChild>
			{/* ... existing button ... */}
		</DialogTrigger>
		<DialogContent className="sm:max-w-xl">
			{/* ... same dialog content ... */}
		</DialogContent>
	</Dialog>
);
```

To avoid duplicating the dialog content, extract it into a local variable:

```typescript
const dialogContent = (
	<DialogContent className="sm:max-w-xl">
		<DialogHeader>
			<DialogTitle>{t("title")}</DialogTitle>
			<DialogDescription>{t("description")}</DialogDescription>
		</DialogHeader>
		{/* ... rest of the existing dialog body ... */}
	</DialogContent>
);

if (props.dialogOnly) {
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			{dialogContent}
		</Dialog>
	);
}

return (
	<Dialog open={open} onOpenChange={setOpen}>
		<DialogTrigger asChild>
			<Button variant={variant} size={size} className={cn("gap-2", className)}>
				<CalendarDays className="h-4 w-4" />
				{t("button")}
				{isOnVacationNow ? <Badge variant="secondary">{t("badgeOn")}</Badge> : null}
			</Button>
		</DialogTrigger>
		{dialogContent}
	</Dialog>
);
```

- [ ] **Step 4: Verify existing usage still works**

The existing header button uses `<OwnerUnavailabilityButton />` with no new props, so it should work identically. Check by searching for all usages:

```bash
grep -rn "OwnerUnavailabilityButton" --include="*.tsx" --include="*.ts" .
```

- [ ] **Step 5: Commit**

```bash
git add components/owner-unavailability-button.tsx
git commit -m "refactor(vacation): extract dialog for reuse, add initialDate and dialogOnly props"
```

---

### Task 5: "Up Next" action cards component

**Files:**
- Create: `components/calendar/up-next-section.tsx`

- [ ] **Step 1: Create the UpNextSection component**

```typescript
// components/calendar/up-next-section.tsx
"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

type ActionType = "respond" | "schedule" | "confirm";

interface CalendarEvent {
	id: string;
	type: "lending" | "borrowing" | "vacation";
	title: string;
	startDate: number;
	endDate: number;
	isAllDay: boolean;
	itemId?: string;
	claimId?: string;
	needsAction?: ActionType | null;
	counterpartyName?: string;
}

interface UpNextSectionProps {
	events: CalendarEvent[];
	locale: string;
}

const ACTION_CONFIG: Record<ActionType, { label: string; color: string; bgColor: string; linkLabel: string }> = {
	respond: {
		label: "RESPOND",
		color: "text-amber-500",
		bgColor: "bg-amber-500/20",
		linkLabel: "Review →",
	},
	schedule: {
		label: "SCHEDULE",
		color: "text-blue-400",
		bgColor: "bg-blue-500/20",
		linkLabel: "Schedule →",
	},
	confirm: {
		label: "CONFIRM",
		color: "text-emerald-400",
		bgColor: "bg-emerald-500/20",
		linkLabel: "Confirm →",
	},
};

const BORDER_COLORS: Record<ActionType, string> = {
	respond: "border-l-amber-500",
	schedule: "border-l-blue-500",
	confirm: "border-l-emerald-500",
};

export function UpNextSection({ events, locale }: UpNextSectionProps) {
	const actionEvents = useMemo(() => {
		return events
			.filter((e): e is CalendarEvent & { needsAction: ActionType } => !!e.needsAction)
			.sort((a, b) => a.startDate - b.startDate)
			.slice(0, 5);
	}, [events]);

	const totalCount = useMemo(() => {
		return events.filter((e) => !!e.needsAction).length;
	}, [events]);

	if (actionEvents.length === 0) return null;

	return (
		<div className="mb-4">
			<div className="flex items-center justify-between mb-2">
				<div className="flex items-center gap-2">
					<h3 className="text-sm font-semibold">Up Next</h3>
					<span className="bg-amber-500 text-amber-950 text-xs font-bold px-1.5 py-0.5 rounded-full">
						{totalCount}
					</span>
				</div>
				{totalCount > 5 && (
					<span className="text-xs text-muted-foreground">
						See all →
					</span>
				)}
			</div>

			<div className="flex gap-2.5 overflow-x-auto pb-1">
				{actionEvents.map((event) => {
					const config = ACTION_CONFIG[event.needsAction];
					const borderColor = BORDER_COLORS[event.needsAction];
					const dateRange = formatDateRange(event.startDate, event.endDate);

					return (
						<div
							key={event.id}
							className={cn(
								"flex-shrink-0 w-56 rounded-lg border-l-[3px] bg-card p-3",
								borderColor,
							)}
						>
							<span
								className={cn(
									"text-[10px] font-semibold px-1.5 py-0.5 rounded",
									config.color,
									config.bgColor,
								)}
							>
								{config.label}
							</span>
							<p className="mt-1.5 text-sm font-medium truncate">
								{getActionDescription(event)}
							</p>
							<p className="text-xs text-muted-foreground mt-0.5">
								{event.title.split("→")[1]?.trim() || event.title.split("←")[1]?.trim() || ""} · {dateRange}
							</p>
							<Link
								href={`/${locale}/item/${event.itemId}`}
								className="text-xs text-primary mt-2 inline-block"
							>
								{config.linkLabel}
							</Link>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function getActionDescription(event: CalendarEvent & { needsAction: ActionType }): string {
	const itemName = event.title.split(/[→←]/)[0].trim();
	switch (event.needsAction) {
		case "respond":
			return event.type === "lending"
				? `Approve request for ${itemName}`
				: `Respond to ${itemName}`;
		case "schedule":
			return `Propose pickup for ${itemName}`;
		case "confirm":
			return `Confirm handoff for ${itemName}`;
	}
}

function formatDateRange(start: number, end: number): string {
	const s = new Date(start);
	const e = new Date(end);
	const month = s.toLocaleDateString("en", { month: "short" });
	return `${month} ${s.getDate()}–${e.getDate()}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add components/calendar/up-next-section.tsx
git commit -m "feat(calendar): add UpNextSection component for pending action cards"
```

---

### Task 6: Event detail popover component

**Files:**
- Create: `components/calendar/calendar-event-popover.tsx`

- [ ] **Step 1: Create the EventPopover component**

```typescript
// components/calendar/calendar-event-popover.tsx
"use client";

import { useCallback } from "react";
import Link from "next/link";
import { Calendar, Download, X } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import {
	buildGoogleCalendarUrl,
	downloadIcsFile,
} from "./calendar-export-utils";

type ActionType = "respond" | "schedule" | "confirm";

interface CalendarEvent {
	id: string;
	type: "lending" | "borrowing" | "vacation";
	title: string;
	startDate: number;
	endDate: number;
	isAllDay: boolean;
	itemId?: string;
	claimId?: string;
	needsAction?: ActionType | null;
	counterpartyName?: string;
	vacationNote?: string;
}

interface EventPopoverProps {
	event: CalendarEvent;
	position: { top: number; left: number };
	onClose: () => void;
	locale: string;
}

const TYPE_LABELS: Record<CalendarEvent["type"], string> = {
	lending: "Lending",
	borrowing: "Borrowing",
	vacation: "Vacation",
};

const TYPE_COLORS: Record<CalendarEvent["type"], string> = {
	lending: "bg-indigo-500",
	borrowing: "bg-violet-500",
	vacation: "bg-red-500",
};

export function EventPopover({ event, position, onClose, locale }: EventPopoverProps) {
	const itemName = event.title.split(/[→←]/)[0].trim();
	const exportData = {
		title: event.title,
		startDate: event.startDate,
		endDate: event.endDate,
		isAllDay: event.isAllDay,
		description: event.type === "vacation"
			? event.vacationNote
			: `Sharity ${event.type}: ${event.title}`,
	};

	const handleGoogleCal = useCallback(() => {
		const url = buildGoogleCalendarUrl(exportData);
		window.open(url, "_blank");
	}, [exportData]);

	const handleIcs = useCallback(() => {
		downloadIcsFile(exportData);
	}, [exportData]);

	return (
		<div
			className="fixed z-50 w-72 rounded-xl border bg-popover text-popover-foreground shadow-lg p-4"
			style={{ top: position.top, left: position.left }}
		>
			{/* Header */}
			<div className="flex justify-between items-start mb-3">
				<div>
					<div className="flex items-center gap-1.5 mb-1">
						<span className={`inline-block w-2.5 h-2.5 rounded-sm ${TYPE_COLORS[event.type]}`} />
						<span className="text-[11px] text-muted-foreground uppercase tracking-wide">
							{TYPE_LABELS[event.type]}
						</span>
					</div>
					<h3 className="text-sm font-semibold">{itemName}</h3>
					{event.counterpartyName && (
						<p className="text-xs text-muted-foreground mt-0.5">
							{event.type === "lending" ? "to " : "from "}
							{event.counterpartyName}
						</p>
					)}
				</div>
				<button
					onClick={onClose}
					className="text-muted-foreground hover:text-foreground p-0.5"
				>
					<X className="h-4 w-4" />
				</button>
			</div>

			{/* Dates */}
			<div className="rounded-lg bg-muted/50 p-2.5 mb-3 space-y-1">
				<div className="flex justify-between text-xs">
					<span className="text-muted-foreground">
						{event.type === "vacation" ? "Start" : "Pickup"}
					</span>
					<span>
						{event.isAllDay
							? format(new Date(event.startDate), "MMM d, yyyy")
							: format(new Date(event.startDate), "MMM d, h:mm a")}
					</span>
				</div>
				<div className="flex justify-between text-xs">
					<span className="text-muted-foreground">
						{event.type === "vacation" ? "End" : "Return"}
					</span>
					<span>
						{event.isAllDay
							? format(new Date(event.endDate), "MMM d, yyyy")
							: format(new Date(event.endDate), "MMM d, h:mm a")}
					</span>
				</div>
			</div>

			{/* Vacation note */}
			{event.vacationNote && (
				<p className="text-xs text-muted-foreground mb-3 italic">
					{event.vacationNote}
				</p>
			)}

			{/* Export buttons */}
			<div className="flex gap-2 mb-2">
				<Button
					variant="outline"
					size="sm"
					className="flex-1 text-xs h-8"
					onClick={handleGoogleCal}
				>
					<Calendar className="h-3 w-3 mr-1" />
					Google Cal
				</Button>
				<Button
					variant="outline"
					size="sm"
					className="flex-1 text-xs h-8"
					onClick={handleIcs}
				>
					<Download className="h-3 w-3 mr-1" />
					.ics
				</Button>
			</div>

			{/* Link to detail page */}
			{event.itemId && (
				<Link
					href={`/${locale}/item/${event.itemId}`}
					className="text-xs text-primary block text-center mt-1"
				>
					View item details →
				</Link>
			)}
		</div>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add components/calendar/calendar-event-popover.tsx
git commit -m "feat(calendar): add event detail popover with export buttons"
```

---

### Task 7: Main `EnhancedCalendar` component

**Files:**
- Create: `components/calendar/enhanced-calendar.tsx`

This is the orchestrator — renders FullCalendar with custom event styling, the UpNextSection, the EventPopover, and triggers the vacation dialog on date selection.

- [ ] **Step 1: Create the component**

```typescript
// components/calendar/enhanced-calendar.tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import dynamic from "next/dynamic";
import type { DateSelectArg, EventClickArg, DatesSetArg, EventInput } from "@fullcalendar/core";
import { useLocale } from "next-intl";

import { api } from "@/convex/_generated/api";
import { UpNextSection } from "./up-next-section";
import { EventPopover } from "./calendar-event-popover";
import { OwnerUnavailabilityButton } from "@/components/owner-unavailability-button";

// FullCalendar doesn't support SSR — dynamic import required
const FullCalendar = dynamic(
	() => import("@fullcalendar/react").then((mod) => mod.default),
	{ ssr: false, loading: () => <div className="h-[600px] bg-muted/20 animate-pulse rounded-lg" /> },
);

// Plugins need to be imported dynamically too
const dayGridPlugin = dynamic(
	() => import("@fullcalendar/daygrid").then((mod) => mod.default),
	{ ssr: false },
);

const interactionPlugin = dynamic(
	() => import("@fullcalendar/interaction").then((mod) => mod.default),
	{ ssr: false },
);

// NOTE: FullCalendar plugins are NOT React components — they must be imported
// at module level or inside the component that uses FullCalendar.
// The dynamic import approach above may not work for plugins.
// If it doesn't, we'll use a wrapper approach instead (see Step 2).

type PopoverState = {
	event: CalendarEvent;
	position: { top: number; left: number };
} | null;

type VacationDialogState = {
	startDate: Date;
	endDate: Date;
} | null;

interface CalendarEvent {
	id: string;
	type: "lending" | "borrowing" | "vacation";
	title: string;
	startDate: number;
	endDate: number;
	isAllDay: boolean;
	itemId?: string;
	claimId?: string;
	needsAction?: "respond" | "schedule" | "confirm" | null;
	counterpartyName?: string;
	vacationNote?: string;
}

const EVENT_COLORS: Record<CalendarEvent["type"], { backgroundColor: string; borderColor: string; textColor: string }> = {
	lending: { backgroundColor: "#6366f1", borderColor: "#6366f1", textColor: "#ffffff" },
	borrowing: { backgroundColor: "#8b5cf6", borderColor: "#8b5cf6", textColor: "#ffffff" },
	vacation: { backgroundColor: "rgba(239, 68, 68, 0.25)", borderColor: "#ef4444", textColor: "#f87171" },
};

export function EnhancedCalendar() {
	const locale = useLocale();
	const [dateRange, setDateRange] = useState(() => {
		const now = new Date();
		return {
			startDate: new Date(now.getFullYear(), now.getMonth(), 1).getTime(),
			endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0).getTime(),
		};
	});

	const calendarEvents = useQuery(api.items.getCalendarEvents, dateRange) ?? [];

	const [popover, setPopover] = useState<PopoverState>(null);
	const [vacationDialog, setVacationDialog] = useState<VacationDialogState>(null);

	// Convert to FullCalendar event format
	const fcEvents: EventInput[] = useMemo(() => {
		return calendarEvents.map((event) => {
			const colors = EVENT_COLORS[event.type];
			// FullCalendar expects end date to be exclusive for all-day events
			let end: Date | string;
			if (event.isAllDay) {
				const endDate = new Date(event.endDate);
				endDate.setDate(endDate.getDate() + 1);
				end = endDate.toISOString().split("T")[0];
			} else {
				end = new Date(event.endDate).toISOString();
			}

			return {
				id: event.id,
				title: event.title,
				start: event.isAllDay
					? new Date(event.startDate).toISOString().split("T")[0]
					: new Date(event.startDate).toISOString(),
				end,
				allDay: event.isAllDay,
				backgroundColor: colors.backgroundColor,
				borderColor: colors.borderColor,
				textColor: colors.textColor,
				extendedProps: {
					calendarEvent: event,
					needsAction: event.needsAction,
				},
				classNames: event.needsAction ? ["fc-event-needs-action"] : [],
			};
		});
	}, [calendarEvents]);

	const handleEventClick = useCallback((info: EventClickArg) => {
		const rect = info.el.getBoundingClientRect();
		const event = info.event.extendedProps.calendarEvent as CalendarEvent;
		setPopover({
			event,
			position: {
				top: rect.bottom + window.scrollY + 4,
				left: Math.min(rect.left, window.innerWidth - 300),
			},
		});
	}, []);

	const handleDateSelect = useCallback((info: DateSelectArg) => {
		// Drag-select on empty days → open vacation dialog
		setVacationDialog({
			startDate: info.start,
			endDate: new Date(info.end.getTime() - 1), // FullCalendar end is exclusive
		});
	}, []);

	const handleDatesSet = useCallback((info: DatesSetArg) => {
		setDateRange({
			startDate: info.start.getTime(),
			endDate: info.end.getTime(),
		});
	}, []);

	const handleClosePopover = useCallback(() => {
		setPopover(null);
	}, []);

	return (
		<div className="space-y-4">
			<UpNextSection events={calendarEvents} locale={locale} />

			<FullCalendarWrapper
				events={fcEvents}
				onEventClick={handleEventClick}
				onDateSelect={handleDateSelect}
				onDatesSet={handleDatesSet}
			/>

			{popover && (
				<EventPopover
					event={popover.event}
					position={popover.position}
					onClose={handleClosePopover}
					locale={locale}
				/>
			)}

			{vacationDialog && (
				<OwnerUnavailabilityButton
					dialogOnly
					open
					onOpenChange={(open) => {
						if (!open) setVacationDialog(null);
					}}
					initialStartDate={vacationDialog.startDate}
					initialEndDate={vacationDialog.endDate}
				/>
			)}
		</div>
	);
}

/**
 * Wrapper that handles the dynamic import of FullCalendar + plugins.
 * FullCalendar plugins are plain JS objects, not React components,
 * so they need to be imported inside the same dynamic boundary.
 */
function FullCalendarWrapperInner(props: {
	events: EventInput[];
	onEventClick: (info: EventClickArg) => void;
	onDateSelect: (info: DateSelectArg) => void;
	onDatesSet: (info: DatesSetArg) => void;
}) {
	// These imports work because this component is only rendered client-side
	const FullCalendarComponent = require("@fullcalendar/react").default;
	const dayGrid = require("@fullcalendar/daygrid").default;
	const interaction = require("@fullcalendar/interaction").default;

	return (
		<FullCalendarComponent
			plugins={[dayGrid, interaction]}
			initialView="dayGridMonth"
			events={props.events}
			selectable
			selectMirror
			dayMaxEvents={3}
			eventClick={props.onEventClick}
			select={props.onDateSelect}
			datesSet={props.onDatesSet}
			headerToolbar={{
				left: "prev,next today",
				center: "title",
				right: "",
			}}
			height="auto"
		/>
	);
}

const FullCalendarWrapper = dynamic(
	() => Promise.resolve(FullCalendarWrapperInner),
	{
		ssr: false,
		loading: () => (
			<div className="h-[600px] bg-muted/20 animate-pulse rounded-lg" />
		),
	},
);
```

- [ ] **Step 2: Add FullCalendar CSS overrides for theming and action markers**

Add to `app/globals.css`:

```css
/* FullCalendar theme overrides */
.fc {
  --fc-border-color: hsl(var(--border));
  --fc-today-bg-color: hsl(var(--accent) / 0.1);
  --fc-page-bg-color: transparent;
  --fc-neutral-bg-color: transparent;
}

.fc .fc-daygrid-day-number {
  font-size: 0.875rem;
  padding: 4px 8px;
}

.fc .fc-col-header-cell-cushion {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: hsl(var(--muted-foreground));
}

.fc .fc-button {
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  padding: 0.25rem 0.75rem;
  border-radius: 0.375rem;
}

.fc .fc-button:hover {
  background: hsl(var(--accent));
}

.fc .fc-button-active {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.fc .fc-toolbar-title {
  font-size: 1.25rem;
  font-weight: 600;
}

/* Action marker dot on events needing attention */
.fc-event-needs-action .fc-event-title::before {
  content: "";
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #f59e0b;
  box-shadow: 0 0 4px #f59e0b;
  margin-right: 4px;
  vertical-align: middle;
}

/* Mobile: hide event text, show only colored bars */
@media (max-width: 640px) {
  .fc .fc-daygrid-event-harness {
    font-size: 0;
  }

  .fc .fc-daygrid-dot-event .fc-event-title {
    display: none;
  }

  .fc .fc-daygrid-block-event .fc-event-title-container {
    font-size: 0;
    min-height: 4px;
  }

  .fc .fc-daygrid-day {
    min-height: 60px;
  }

  .fc-event-needs-action .fc-event-title::before {
    margin-right: 0;
  }
}
```

- [ ] **Step 3: Verify the component renders without errors**

Create a temporary test page or check that `EnhancedCalendar` can be imported without build errors:

```bash
cd /Users/eugenia_bogacheva/PersonalProjects/sharity/.worktrees/enhanced-calendar
pnpm build 2>&1 | tail -30
```

If there are import errors related to FullCalendar's dynamic loading pattern, adjust the wrapper approach — the `require()` pattern inside a dynamically imported component is the most reliable for FullCalendar with Next.js.

- [ ] **Step 4: Commit**

```bash
git add components/calendar/enhanced-calendar.tsx app/globals.css
git commit -m "feat(calendar): add main EnhancedCalendar component with FullCalendar integration"
```

---

### Task 8: Wire up the calendar to a page

**Files:**
- Determine where the calendar lives. Since the tab restructuring is a separate effort, create a standalone page for now.
- Create: `app/[locale]/calendar/page.tsx` (or modify existing My Items page if appropriate)

- [ ] **Step 1: Check current routing structure**

```bash
ls app/*/my-items/ 2>/dev/null || ls app/my-items/ 2>/dev/null
find app -name "page.tsx" -not -path "*/node_modules/*" | head -20
```

- [ ] **Step 2: Create the calendar page**

Based on the existing app structure, create the route. The calendar page is a standalone authenticated view:

```typescript
// app/[locale]/calendar/page.tsx  (adjust path based on step 1 findings)
import dynamic from "next/dynamic";

const EnhancedCalendar = dynamic(
	() =>
		import("@/components/calendar/enhanced-calendar").then(
			(mod) => mod.EnhancedCalendar,
		),
	{
		ssr: false,
		loading: () => (
			<div className="h-[600px] bg-muted/20 animate-pulse rounded-lg" />
		),
	},
);

export default function CalendarPage() {
	return (
		<main className="min-h-screen bg-background">
			<div className="container mx-auto px-4 py-6">
				<EnhancedCalendar />
			</div>
		</main>
	);
}
```

- [ ] **Step 3: Verify the page loads**

```bash
cd /Users/eugenia_bogacheva/PersonalProjects/sharity/.worktrees/enhanced-calendar
pnpm build 2>&1 | tail -30
```

- [ ] **Step 4: Commit**

```bash
git add app/
git commit -m "feat(calendar): add calendar page route"
```

---

### Task 9: Manual integration testing

**Files:** None (testing pass)

- [ ] **Step 1: Start the dev server and Convex**

```bash
cd /Users/eugenia_bogacheva/PersonalProjects/sharity/.worktrees/enhanced-calendar
pnpm dev &
pnpm convex:dev &
```

- [ ] **Step 2: Test the calendar page**

Open `http://localhost:3000/calendar` (or the locale-prefixed URL) in a browser. Verify:
1. FullCalendar month grid renders
2. Navigation (prev/next month, today) works
3. If there are existing claims/leases, they appear as colored bars
4. If there are vacation ranges, they appear as red shaded bars
5. Clicking an event bar shows the popover with details
6. "Add to Google Cal" opens Google Calendar in a new tab with pre-filled event
7. "Download .ics" downloads a calendar file
8. Drag-selecting empty dates opens the vacation creation dialog
9. "Up Next" section appears when there are events needing action
10. Mobile view (resize browser to < 640px) shows compressed calendar

- [ ] **Step 3: Fix any issues found during testing**

Address any bugs, styling issues, or interaction problems discovered in step 2.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "fix(calendar): address integration testing feedback"
```
