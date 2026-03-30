"use client";

import { formatDistanceToNowStrict, isPast } from "date-fns";
import {
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	Clock,
	Inbox,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { CalendarEvent } from "@/convex/items";
import { cn } from "@/lib/utils";

interface UpNextSectionProps {
	events: CalendarEvent[];
	locale: string;
}

type ActionType =
	| "respond_request"
	| "respond_pickup"
	| "respond_return"
	| "schedule_pickup"
	| "schedule_return"
	| "confirm_pickup"
	| "confirm_return";

interface ActionConfig {
	label: string;
	icon: typeof Inbox;
	actionPhrase: string;
}

const ACTION_CONFIG: Record<ActionType, ActionConfig> = {
	respond_request: {
		label: "RESPOND",
		icon: Inbox,
		actionPhrase: "Approve request",
	},
	respond_pickup: {
		label: "SCHEDULE",
		icon: Clock,
		actionPhrase: "Approve pickup time",
	},
	respond_return: {
		label: "SCHEDULE",
		icon: Clock,
		actionPhrase: "Approve return time",
	},
	schedule_pickup: {
		label: "SCHEDULE",
		icon: Clock,
		actionPhrase: "Propose pickup",
	},
	schedule_return: {
		label: "SCHEDULE",
		icon: Clock,
		actionPhrase: "Propose return",
	},
	confirm_pickup: {
		label: "CONFIRM",
		icon: CheckCircle2,
		actionPhrase: "Confirm pickup",
	},
	confirm_return: {
		label: "CONFIRM",
		icon: CheckCircle2,
		actionPhrase: "Confirm return",
	},
};

type UrgencyLevel = "urgent" | "soon" | "safe";

const URGENCY_STYLES: Record<
	UrgencyLevel,
	{ badgeClass: string; iconClass: string }
> = {
	urgent: {
		badgeClass: "bg-orange-100 text-orange-800",
		iconClass: "text-orange-500",
	},
	soon: {
		badgeClass: "bg-amber-100 text-amber-800",
		iconClass: "text-amber-500",
	},
	safe: {
		badgeClass: "bg-muted text-muted-foreground",
		iconClass: "text-muted-foreground",
	},
};

function getUrgencyLevel(endDate: number): UrgencyLevel {
	const msLeft = endDate - Date.now();
	const ONE_DAY = 86_400_000;
	if (msLeft < 2 * ONE_DAY) return "urgent";
	if (msLeft < 5 * ONE_DAY) return "soon";
	return "safe";
}

const CARDS_PER_ROW = 3;

/** Strip prefixes and counterparty arrows from item titles */
function cleanItemName(title: string): string {
	return title.replace(/^\[.*?\]\s*/, "").replace(/\s*[←→].*$/, "");
}

function getUrgencyLabel(endDate: number): {
	text: string;
	className: string;
} | null {
	const now = Date.now();
	const end = new Date(endDate);

	if (isPast(end)) {
		return {
			text: "Overdue",
			className: "text-orange-700 bg-orange-100 font-semibold animate-pulse",
		};
	}

	const msLeft = endDate - now;
	const ONE_DAY = 86_400_000;

	if (msLeft < ONE_DAY) {
		return {
			text: "Due today",
			className: "text-orange-700 bg-orange-100 font-semibold animate-pulse",
		};
	}
	if (msLeft < 2 * ONE_DAY) {
		return {
			text: "Due tomorrow",
			className: "text-orange-700 bg-orange-100 font-medium",
		};
	}

	const ONE_DAY_5 = 5 * ONE_DAY;
	if (msLeft < ONE_DAY_5) {
		const days = Math.ceil(msLeft / ONE_DAY);
		return {
			text: `In ${days} days`,
			className: "text-amber-700 bg-amber-100/80",
		};
	}

	const dist = formatDistanceToNowStrict(end);
	return {
		text: `In ${dist}`,
		className: "text-stone-600 bg-stone-200/80",
	};
}

function getInitials(name: string): string {
	return name
		.split(/[\s_]+/)
		.slice(0, 2)
		.map((w) => w[0]?.toUpperCase() ?? "")
		.join("");
}

interface ActionCardProps {
	event: CalendarEvent;
	locale: string;
}

function ActionCard({ event, locale }: ActionCardProps) {
	const action = event.needsAction as ActionType;
	const config = ACTION_CONFIG[action];
	const Icon = config.icon;
	const itemName = cleanItemName(event.title);
	const href = event.itemId ? `/${locale}/item/${event.itemId}` : "#";
	const urgency = getUrgencyLabel(event.endDate);
	const level = getUrgencyLevel(event.endDate);
	const styles = URGENCY_STYLES[level];
	const initials = event.counterpartyName
		? getInitials(event.counterpartyName)
		: null;

	return (
		<Link
			href={href}
			className="flex-1 min-w-0 rounded-lg border bg-card shadow-sm p-3 flex flex-col gap-2 hover:shadow-md transition-all"
		>
			{/* Top row: icon + badge + urgency */}
			<div className="flex items-center gap-1.5">
				<Icon className={cn("h-3.5 w-3.5 shrink-0", styles.iconClass)} />
				<span
					className={cn(
						"shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide leading-none",
						styles.badgeClass,
					)}
				>
					{config.label}
				</span>
				{urgency && (
					<span
						className={cn(
							"ml-auto shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] leading-none",
							urgency.className,
						)}
					>
						{urgency.text}
					</span>
				)}
			</div>

			{/* Counterparty with initials avatar */}
			{event.counterpartyName && (
				<div className="flex items-center gap-2">
					{initials && (
						<span className="shrink-0 h-6 w-6 rounded-full bg-muted text-[10px] font-medium flex items-center justify-center text-muted-foreground">
							{initials}
						</span>
					)}
					<div className="min-w-0">
						<p className="text-sm font-semibold leading-snug truncate">
							{itemName}
						</p>
						<p className="text-xs text-muted-foreground">
							{event.type === "lending" ? "to" : "from"}{" "}
							{event.counterpartyName}
						</p>
					</div>
				</div>
			)}
			{!event.counterpartyName && (
				<p className="text-sm font-semibold leading-snug line-clamp-2">
					{itemName}
				</p>
			)}

			{/* CTA button */}
			<span className="mt-auto inline-flex items-center justify-center rounded-md bg-secondary text-secondary-foreground px-3 py-1.5 text-xs font-medium hover:bg-secondary/80 transition-colors">
				{config.actionPhrase}
			</span>
		</Link>
	);
}

export function UpNextSection({ events, locale }: UpNextSectionProps) {
	const [expanded, setExpanded] = useState(false);

	const actionEvents = useMemo(() => {
		return events
			.filter((e) => e.needsAction != null)
			.sort((a, b) => a.startDate - b.startDate);
	}, [events]);

	const toggleExpanded = useCallback(() => setExpanded((v) => !v), []);

	if (actionEvents.length === 0) {
		return null;
	}

	const hasMore = actionEvents.length > CARDS_PER_ROW;
	const visibleEvents = expanded
		? actionEvents
		: actionEvents.slice(0, CARDS_PER_ROW);

	return (
		<div className="mb-4">
			{/* Section header */}
			<div className="flex items-center gap-2 mb-2">
				<h2 className="text-sm font-semibold text-foreground">Up Next</h2>
				<span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 min-w-[1.25rem]">
					{actionEvents.length}
				</span>
			</div>

			{/* Card grid — 3 per row */}
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
				{visibleEvents.map((event) => (
					<ActionCard key={event.id} event={event} locale={locale} />
				))}
			</div>

			{/* Expand / collapse */}
			{hasMore && (
				<div className="flex justify-center mt-2">
					<Button
						variant="ghost"
						size="sm"
						className="text-xs text-muted-foreground gap-1"
						onClick={toggleExpanded}
					>
						{expanded ? (
							<>
								Show less <ChevronUp className="h-3 w-3" />
							</>
						) : (
							<>
								{actionEvents.length - CARDS_PER_ROW} more{" "}
								<ChevronDown className="h-3 w-3" />
							</>
						)}
					</Button>
				</div>
			)}
		</div>
	);
}
