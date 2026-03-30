"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useMemo } from "react";

import type { CalendarEvent } from "@/convex/items";
import { cn } from "@/lib/utils";

interface UpNextSectionProps {
	events: CalendarEvent[];
	locale: string;
}

type ActionType = "respond" | "schedule" | "confirm";

interface ActionConfig {
	label: string;
	badgeClass: string;
	borderClass: string;
	linkText: string;
}

const ACTION_CONFIG: Record<ActionType, ActionConfig> = {
	respond: {
		label: "RESPOND",
		badgeClass: "bg-amber-100 text-amber-700",
		borderClass: "border-l-amber-400",
		linkText: "Review →",
	},
	schedule: {
		label: "SCHEDULE",
		badgeClass: "bg-blue-100 text-blue-700",
		borderClass: "border-l-blue-400",
		linkText: "Schedule →",
	},
	confirm: {
		label: "CONFIRM",
		badgeClass: "bg-green-100 text-green-700",
		borderClass: "border-l-green-400",
		linkText: "Confirm →",
	},
};

const MAX_VISIBLE = 5;

function getActionDescription(event: CalendarEvent): string {
	const itemName = event.title;
	const action = event.needsAction as ActionType;

	if (action === "respond") {
		if (event.type === "lending") {
			return `Approve request for ${itemName}`;
		}
		return `Respond to ${itemName}`;
	}

	if (action === "schedule") {
		return `Propose pickup for ${itemName}`;
	}

	if (action === "confirm") {
		return `Confirm handoff for ${itemName}`;
	}

	return itemName;
}

function formatDateRange(
	startDate: number,
	endDate: number,
	isAllDay: boolean,
): string {
	const formatStr = isAllDay ? "MMM d" : "MMM d, h:mm a";
	const start = format(startDate, formatStr);
	const end = format(endDate, formatStr);
	return `${start} – ${end}`;
}

interface ActionCardProps {
	event: CalendarEvent;
	locale: string;
}

function ActionCard({ event, locale }: ActionCardProps) {
	const action = event.needsAction as ActionType;
	const config = ACTION_CONFIG[action];
	const description = getActionDescription(event);
	const dateRange = formatDateRange(
		event.startDate,
		event.endDate,
		event.isAllDay,
	);

	const href = event.itemId ? `/${locale}/item/${event.itemId}` : "#";

	return (
		<div
			className={cn(
				"w-56 flex-shrink-0 rounded-lg border bg-card shadow-sm border-l-4 p-3 flex flex-col gap-1.5",
				config.borderClass,
			)}
		>
			{/* Action badge */}
			<span
				className={cn(
					"inline-flex w-fit rounded px-1.5 py-0.5 text-xs font-semibold tracking-wide",
					config.badgeClass,
				)}
			>
				{config.label}
			</span>

			{/* Action description */}
			<p className="text-sm font-medium leading-snug line-clamp-2">
				{description}
			</p>

			{/* Counterparty */}
			{event.counterpartyName && (
				<p className="text-xs text-muted-foreground truncate">
					{event.type === "lending"
						? `to ${event.counterpartyName}`
						: `from ${event.counterpartyName}`}
				</p>
			)}

			{/* Date range */}
			<p className="text-xs text-muted-foreground">{dateRange}</p>

			{/* Link */}
			{event.itemId && (
				<Link
					href={href}
					className="text-xs font-medium text-primary hover:underline mt-auto pt-0.5"
				>
					{config.linkText}
				</Link>
			)}
		</div>
	);
}

export function UpNextSection({ events, locale }: UpNextSectionProps) {
	const actionEvents = useMemo(() => {
		return events
			.filter((e) => e.needsAction != null)
			.sort((a, b) => a.startDate - b.startDate);
	}, [events]);

	if (actionEvents.length === 0) {
		return null;
	}

	const visibleEvents = actionEvents.slice(0, MAX_VISIBLE);
	const hiddenCount = actionEvents.length - visibleEvents.length;

	return (
		<div className="mb-4">
			{/* Section header */}
			<div className="flex items-center gap-2 mb-2">
				<h2 className="text-sm font-semibold text-foreground">Up Next</h2>
				<span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 min-w-[1.25rem]">
					{actionEvents.length}
				</span>
			</div>

			{/* Scrollable card list */}
			<div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
				{visibleEvents.map((event) => (
					<ActionCard key={event.id} event={event} locale={locale} />
				))}

				{/* "See all" overflow card */}
				{hiddenCount > 0 && (
					<div className="w-56 flex-shrink-0 rounded-lg border bg-muted/40 p-3 flex flex-col items-center justify-center gap-1 text-center">
						<span className="text-sm font-medium text-muted-foreground">
							+{hiddenCount} more
						</span>
						<Link
							href={`/${locale}/calendar`}
							className="text-xs font-medium text-primary hover:underline"
						>
							See all →
						</Link>
					</div>
				)}
			</div>
		</div>
	);
}
