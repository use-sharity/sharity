"use client";

import { isPast } from "date-fns";
import {
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	Clock,
	Inbox,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
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
	labelKey: string;
	icon: typeof Inbox;
	actionKey: string;
}

const ACTION_CONFIG: Record<ActionType, ActionConfig> = {
	respond_request: {
		labelKey: "actions.respond",
		icon: Inbox,
		actionKey: "actions.approveRequest",
	},
	respond_pickup: {
		labelKey: "actions.schedule",
		icon: Clock,
		actionKey: "actions.approvePickupTime",
	},
	respond_return: {
		labelKey: "actions.schedule",
		icon: Clock,
		actionKey: "actions.approveReturnTime",
	},
	schedule_pickup: {
		labelKey: "actions.schedule",
		icon: Clock,
		actionKey: "actions.proposePickup",
	},
	schedule_return: {
		labelKey: "actions.schedule",
		icon: Clock,
		actionKey: "actions.proposeReturn",
	},
	confirm_pickup: {
		labelKey: "actions.confirm",
		icon: CheckCircle2,
		actionKey: "actions.confirmPickup",
	},
	confirm_return: {
		labelKey: "actions.confirm",
		icon: CheckCircle2,
		actionKey: "actions.confirmReturn",
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

function getUrgencyLabel(
	endDate: number,
	t: ReturnType<typeof useTranslations>,
): { text: string; className: string } | null {
	const now = Date.now();
	const end = new Date(endDate);

	if (isPast(end)) {
		return {
			text: t("urgency.overdue"),
			className: "text-orange-700 bg-orange-100 font-semibold animate-pulse",
		};
	}

	const msLeft = endDate - now;
	const ONE_DAY = 86_400_000;

	if (msLeft < ONE_DAY) {
		return {
			text: t("urgency.dueToday"),
			className: "text-orange-700 bg-orange-100 font-semibold animate-pulse",
		};
	}
	if (msLeft < 2 * ONE_DAY) {
		return {
			text: t("urgency.dueTomorrow"),
			className: "text-orange-700 bg-orange-100 font-medium",
		};
	}

	const days = Math.ceil(msLeft / ONE_DAY);
	if (msLeft < 5 * ONE_DAY) {
		return {
			text: t("urgency.inDays", { count: days }),
			className: "text-amber-700 bg-amber-100/80",
		};
	}

	return {
		text: t("urgency.inDays", { count: days }),
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
	const t = useTranslations("Calendar");
	const action = event.needsAction as ActionType;
	const config = ACTION_CONFIG[action];
	const Icon = config.icon;
	const itemName = cleanItemName(event.title);
	const href = event.itemId ? `/${locale}/item/${event.itemId}` : "#";
	const urgency = getUrgencyLabel(event.endDate, t);
	const level = getUrgencyLevel(event.endDate);
	const styles = URGENCY_STYLES[level];
	const initials = event.counterpartyName
		? getInitials(event.counterpartyName)
		: null;

	return (
		<Link
			href={href}
			className="flex-1 min-w-0 rounded-lg border bg-card shadow-sm p-2.5 flex flex-col gap-1.5 hover:shadow-md transition-all"
		>
			{/* Top row: icon + badge + urgency */}
			<div className="flex items-center gap-1.5">
				<Icon
					className={cn(
						"h-3.5 w-3.5 shrink-0 hidden sm:block",
						styles.iconClass,
					)}
				/>
				<span
					className={cn(
						"shrink-0 rounded px-1.5 py-0.5 text-[11px] sm:text-[10px] font-semibold tracking-wide leading-none",
						styles.badgeClass,
					)}
				>
					{t(config.labelKey)}
				</span>
				{urgency && (
					<span
						className={cn(
							"ml-auto shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] leading-none hidden sm:inline",
							urgency.className,
						)}
					>
						{urgency.text}
					</span>
				)}
			</div>

			{/* Counterparty with initials avatar — hidden on mobile */}
			{event.counterpartyName && (
				<div className="hidden sm:flex items-center gap-1.5">
					{initials && (
						<span className="shrink-0 h-5 w-5 rounded-full bg-muted text-[9px] font-medium flex items-center justify-center text-muted-foreground">
							{initials}
						</span>
					)}
					<div className="min-w-0">
						<p className="text-sm font-semibold leading-snug truncate">
							{itemName}
						</p>
						<p className="text-xs text-muted-foreground">
							{event.type === "lending"
								? t("counterparty.to", { name: event.counterpartyName })
								: t("counterparty.from", { name: event.counterpartyName })}
						</p>
					</div>
				</div>
			)}
			{/* Item name shown on mobile (counterparty hidden) or when no counterparty */}
			<p
				className={cn(
					"text-sm sm:text-xs font-semibold leading-snug line-clamp-2",
					event.counterpartyName ? "sm:hidden" : "",
				)}
			>
				{itemName}
			</p>

			{/* CTA button — solid for urgent, secondary for others */}
			<span
				className={cn(
					"mt-auto inline-flex items-center justify-center rounded-md px-2.5 py-1.5 sm:py-1 text-xs font-medium transition-colors",
					level === "urgent"
						? "bg-primary text-primary-foreground hover:bg-primary/90"
						: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
				)}
			>
				{t(config.actionKey)}
			</span>
		</Link>
	);
}

export function UpNextSection({ events, locale }: UpNextSectionProps) {
	const t = useTranslations("Calendar");
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
				<h2 className="text-sm font-semibold text-foreground">{t("upNext")}</h2>
				<span className="inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 min-w-[1.25rem]">
					{actionEvents.length}
				</span>
			</div>

			{/* Card grid — 2 on mobile, 3 on desktop */}
			<div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
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
								{t("showLess")} <ChevronUp className="h-3 w-3" />
							</>
						) : (
							<>
								{t("more", {
									count: actionEvents.length - CARDS_PER_ROW,
								})}{" "}
								<ChevronDown className="h-3 w-3" />
							</>
						)}
					</Button>
				</div>
			)}
		</div>
	);
}
