# Enhanced Calendar — Design Spec

## Overview

Replace the current vacation-only header button/dialog with a unified calendar view that shows all user activity — lending periods, borrowing periods, and vacation blocks — in a full month grid. Adds an "Up Next" action summary above the calendar and "Add to Google Calendar" / `.ics` export per event.

## Goals

- **"What's next" at a glance** — one view for all upcoming lending, borrowing, and vacation activity
- **Surface pending actions** — highlight events that need the user's attention (approve, schedule, confirm)
- **Calendar-based vacation management** — create unavailability ranges by drag-selecting dates on the calendar
- **Export to external calendars** — Google Calendar URL and `.ics` file download per event

## Non-Goals

- Full Google Calendar API sync (two-way)
- Navigation/tab restructuring (separate effort in progress)
- Inline actions in the calendar (approve/schedule/confirm happen on the detail page)

## Calendar Library

**FullCalendar** (`@fullcalendar/react`) with these plugins:
- `@fullcalendar/daygrid` — month grid view
- `@fullcalendar/interaction` — date click, drag-select

Style the calendar to match the app's existing theme (Tailwind CSS, shadcn design tokens).

**SSR:** FullCalendar doesn't support SSR. Use `next/dynamic` with `ssr: false` (same pattern as Leaflet/react-leaflet in this project).

## Data Model

### Event Sources

No new database tables. The calendar aggregates from existing sources:

| Event type | Source table | Filter | Color |
|---|---|---|---|
| Lending period | `claims` | `item.ownerId === currentUser` + status in (approved, picked_up) | Indigo (`#6366f1`) |
| Borrowing period | `claims` | `claimerId === currentUser` + status in (approved, picked_up) | Purple (`#8b5cf6`) |
| Vacation | `owner_unavailability` | `ownerId === currentUser` | Red (`#ef4444`) |

### New Convex Query: `getCalendarEvents`

```typescript
getCalendarEvents({
  startDate: v.number(),  // start of visible month range
  endDate: v.number(),    // end of visible month range
})
```

Returns a flat list of normalized events:

```typescript
type CalendarEvent = {
  id: string;                    // claim._id or unavailability._id
  type: "lending" | "borrowing" | "vacation";
  title: string;                 // "Drill → Anna" or "Camera ← Max" or "Vacation"
  startDate: number;             // timestamp
  endDate: number;               // timestamp
  startTime?: number;            // pickup time if known
  endTime?: number;              // return time if known
  isAllDay: boolean;             // true when no specific times set
  itemId?: Id<"items">;
  claimId?: Id<"claims">;
  needsAction?: "respond" | "schedule" | "confirm" | null;
  vacationNote?: string;         // for vacation ranges
};
```

### Time Handling

Borrowing/lending periods use the pickup and return times from the lease activity when available:

| Journey state | Event start | Event end |
|---|---|---|
| Approved, no times proposed | `claim.startDate` (all-day) | `claim.endDate` (all-day) |
| Pickup time proposed/approved | Pickup `windowStartAt` | `claim.endDate` (all-day) |
| Both times set | Pickup `windowStartAt` | Return `windowEndAt` |
| Picked up, no return time | `claim.pickedUpAt` | `claim.endDate` (all-day) |

### Action Detection (`needsAction`)

Determined by the current journey step and viewer role:

| Journey state | Viewer is owner | Viewer is borrower |
|---|---|---|
| Pending (not yet approved) | `"respond"` | `null` |
| Approved, no pickup proposed | `"schedule"` | `"schedule"` |
| Pickup proposed by other party | `"respond"` | `"respond"` |
| Pickup approved, not picked up | `"confirm"` | `"confirm"` |
| Picked up, no return proposed | `"schedule"` | `"schedule"` |
| Return proposed by other party | `"respond"` | `"respond"` |
| Return approved, not returned | `"confirm"` | `"confirm"` |

## Components

### 1. `EnhancedCalendar` (main component)

**File:** `components/enhanced-calendar.tsx`

Orchestrates the full view:
- Renders `UpNextSection` above
- Renders FullCalendar month grid below
- Manages selected date state for popover

**FullCalendar configuration:**
- `initialView: "dayGridMonth"`
- `selectable: true` — enables drag-to-select for vacation creation
- `eventClick` → opens event detail popover
- `select` → opens vacation creation dialog with pre-filled dates
- `datesSet` → fetches events for the visible date range
- `dayMaxEvents: 3` — shows "+N more" when a day has many events

### 2. `UpNextSection`

**File:** `components/up-next-section.tsx`

Horizontally scrollable list of action cards above the calendar. Each card shows:
- Action category badge: RESPOND (amber), SCHEDULE (blue), CONFIRM (green)
- Item name and counterparty
- Date range
- "Review →" / "Schedule →" / "Confirm →" link to item detail page

**Data:** Filters `CalendarEvent[]` to only those with `needsAction !== null`, sorted by date (soonest first), limited to 5.

Shows count badge and "See all →" link when more exist.

**Empty state:** Section is hidden when no actions are pending.

### 3. `EventPopover`

**File:** `components/calendar-event-popover.tsx`

Shown on event bar click. Contains:
- Event type badge + color indicator
- Item name
- Counterparty name (e.g., "from Max" or "to Anna")
- Pickup and return times (when available, otherwise dates only)
- Compact journey stepper showing current step
- "Add to Google Cal" button
- "Download .ics" button
- "View item details →" link

Uses shadcn `Popover` component, positioned relative to the clicked event bar.

### 4. `VacationCreateDialog`

**File:** Modify existing `components/owner-unavailability-button.tsx`

Extract the dialog content into a reusable component that accepts optional `initialStartDate` and `initialEndDate` props. Two entry points:

1. **From calendar:** `EnhancedCalendar`'s `select` callback passes the selected date range and opens the dialog with pre-filled dates.
2. **From header button:** Existing behavior, opens the dialog with no pre-filled dates.

On save, calls existing `addOwnerUnavailabilityRange` mutation. Convex's reactivity automatically updates the calendar.

### Event Bar Styling

Event bars on the calendar use FullCalendar's event rendering with custom classNames:

- **Lending:** solid indigo background, white text
- **Borrowing:** solid purple background, white text
- **Vacation:** semi-transparent red background with red left border
- **Action marker:** small glowing dot on the left edge of the bar, color matches action type (amber/blue/green)

Multi-day events render as bars spanning across day cells (FullCalendar handles this natively with `dayGridMonth` + `allDay` events).

### Mobile Behavior

On small screens (< 640px):
- FullCalendar's `dayGridMonth` naturally compresses
- Configure `dayMaxEvents: 2` on mobile for tighter cells
- Event text hidden, only colored dots/short bars visible
- Tap a day → shows event list below the calendar (FullCalendar's `moreLinkClick` or custom day-click handler)
- "Up Next" section cards stack vertically or stay horizontally scrollable

## Google Calendar / .ics Export

### Google Calendar URL

Client-side URL construction, no API needed:

```
https://calendar.google.com/calendar/render?action=TEMPLATE
  &text={title}
  &dates={startISO}/{endISO}
  &details={description}
```

- Lending/borrowing with times → timed event
- Lending/borrowing without times → all-day event
- Vacation → all-day event

### .ics File

Generate an iCalendar file client-side using a helper function. Contains:
- `VEVENT` with `DTSTART`, `DTEND`, `SUMMARY`, `DESCRIPTION`
- Trigger browser download

No external library needed — the `.ics` format is simple text.

## File Structure

```
components/
├── enhanced-calendar.tsx          # Main calendar component
├── up-next-section.tsx            # "Up Next" action cards
├── calendar-event-popover.tsx     # Event detail popover
├── calendar-export-utils.ts       # Google Cal URL + .ics generation
└── owner-unavailability-button.tsx  # Modified: accept pre-filled dates
convex/
└── items.ts                       # New: getCalendarEvents query
```

## Dependencies

New packages:
- `@fullcalendar/react`
- `@fullcalendar/daygrid`
- `@fullcalendar/interaction`
- `@fullcalendar/core`
