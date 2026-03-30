"use client";

import { format } from "date-fns";
import { Calendar, Download, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { CalendarEvent } from "@/convex/items";

import {
	buildGoogleCalendarUrl,
	downloadIcsFile,
} from "./calendar-export-utils";

interface EventPopoverProps {
	event: CalendarEvent;
	position: { top: number; left: number };
	onClose: () => void;
	onDeleteVacation?: (id: string) => Promise<void>;
	locale: string;
}

const TYPE_LABELS: Record<CalendarEvent["type"], string> = {
	lending: "Lending",
	borrowing: "Borrowing",
	vacation: "Vacation",
};

const TYPE_DOT_COLORS: Record<CalendarEvent["type"], string> = {
	lending: "bg-teal-700",
	borrowing: "bg-amber-500",
	vacation: "bg-gray-400",
};

const TYPE_BADGE_COLORS: Record<CalendarEvent["type"], string> = {
	lending: "bg-teal-100 text-teal-800",
	borrowing: "bg-amber-100 text-amber-800",
	vacation: "bg-gray-100 text-gray-600",
};

function formatEventDate(timestamp: number, isAllDay: boolean): string {
	if (isAllDay) {
		return format(timestamp, "MMM d, yyyy");
	}
	return format(timestamp, "MMM d, h:mm a");
}

export function CalendarEventPopover({
	event,
	position,
	onClose,
	onDeleteVacation,
	locale,
}: EventPopoverProps) {
	const ref = useRef<HTMLDivElement>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				onClose();
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [onClose]);

	const handleGoogleCalClick = useCallback(() => {
		const url = buildGoogleCalendarUrl({
			title: event.title,
			startDate: event.startDate,
			endDate: event.endDate,
			isAllDay: event.isAllDay,
			description: event.vacationNote,
		});
		window.open(url, "_blank");
	}, [event]);

	const handleIcsDownload = useCallback(() => {
		downloadIcsFile({
			title: event.title,
			startDate: event.startDate,
			endDate: event.endDate,
			isAllDay: event.isAllDay,
			description: event.vacationNote,
		});
	}, [event]);

	return (
		<div
			ref={ref}
			className="fixed z-50 w-72 rounded-lg border bg-popover text-popover-foreground shadow-md"
			style={{ top: position.top, left: position.left }}
		>
			{/* Header */}
			<div className="flex items-start justify-between gap-2 p-3 pb-2">
				<div className="flex items-center gap-2 min-w-0">
					<span
						className={`shrink-0 h-2.5 w-2.5 rounded-full ${TYPE_DOT_COLORS[event.type]}`}
					/>
					<span
						className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${TYPE_BADGE_COLORS[event.type]}`}
					>
						{TYPE_LABELS[event.type]}
					</span>
				</div>
				<Button
					variant="ghost"
					size="icon-sm"
					className="shrink-0 h-6 w-6"
					onClick={onClose}
					aria-label="Close"
				>
					<X className="h-3.5 w-3.5" />
				</Button>
			</div>

			{/* Item name */}
			<div className="px-3 pb-1">
				{event.itemId ? (
					<Link
						href={`/${locale}/item/${event.itemId}`}
						className="font-semibold text-sm leading-snug text-primary hover:underline"
						onClick={onClose}
					>
						{event.title}
					</Link>
				) : (
					<p className="font-semibold text-sm leading-snug">{event.title}</p>
				)}
				{event.counterpartyName && (
					<p className="text-xs text-muted-foreground mt-0.5">
						{event.type === "lending"
							? `to ${event.counterpartyName}`
							: `from ${event.counterpartyName}`}
					</p>
				)}
				{event.vacationNote && (
					<p className="text-xs text-muted-foreground mt-0.5">
						{event.vacationNote}
					</p>
				)}
			</div>

			{/* Dates */}
			<div className="mx-3 my-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
				<div className="flex flex-col gap-0.5">
					<span>
						<span className="font-medium text-foreground">
							{event.type === "vacation" ? "Start:" : "Pickup:"}
						</span>{" "}
						{formatEventDate(event.startDate, event.isAllDay)}
					</span>
					<span>
						<span className="font-medium text-foreground">
							{event.type === "vacation" ? "End:" : "Return:"}
						</span>{" "}
						{formatEventDate(event.endDate, event.isAllDay)}
					</span>
				</div>
			</div>

			{/* Export buttons */}
			<div className="grid grid-cols-2 gap-2 px-3 pb-2">
				<Button
					variant="outline"
					size="sm"
					className="text-xs h-8 w-full"
					onClick={handleGoogleCalClick}
				>
					<Calendar className="h-3.5 w-3.5 shrink-0" />
					Google Cal
				</Button>
				<Button
					variant="outline"
					size="sm"
					className="text-xs h-8 w-full"
					onClick={handleIcsDownload}
				>
					<Download className="h-3.5 w-3.5 shrink-0" />
					Download .ics
				</Button>
			</div>

			{/* Delete button for vacation events */}
			{event.type === "vacation" && onDeleteVacation && (
				<div className="border-t px-3 py-2">
					<Button
						variant="ghost"
						size="sm"
						className="w-full text-xs h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
						disabled={isDeleting}
						onClick={async () => {
							setIsDeleting(true);
							try {
								await onDeleteVacation(event.id);
								onClose();
							} finally {
								setIsDeleting(false);
							}
						}}
					>
						<Trash2 className="h-3.5 w-3.5 shrink-0" />
						{isDeleting ? "Deleting..." : "Delete Vacation"}
					</Button>
				</div>
			)}
		</div>
	);
}
