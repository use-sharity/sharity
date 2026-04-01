"use client";

import type { Locale } from "date-fns";
import { format } from "date-fns";
import { enUS, ru, vi as viLocale } from "date-fns/locale";
import { Calendar, Download, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
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

const TYPE_DOT_COLORS: Record<CalendarEvent["type"], string> = {
	lending: "bg-[#2d6a5e]",
	borrowing: "bg-[#2d6a5e]/50",
	vacation: "bg-muted-foreground",
};

const TYPE_BADGE_COLORS: Record<CalendarEvent["type"], string> = {
	lending: "bg-[#2d6a5e]/10 text-[#2d6a5e]",
	borrowing: "bg-[#2d6a5e]/10 text-[#2d6a5e]",
	vacation: "bg-muted text-muted-foreground",
};

const DATE_LOCALES: Record<string, Locale> = { en: enUS, ru, vi: viLocale };

function formatEventDate(
	timestamp: number,
	isAllDay: boolean,
	locale: string,
): string {
	const dateLoc = DATE_LOCALES[locale] ?? enUS;
	if (isAllDay) {
		return format(timestamp, "MMM d, yyyy", { locale: dateLoc });
	}
	// 24h format for non-English locales
	const timeFormat = locale === "en" ? "MMM d, h:mm a" : "MMM d, HH:mm";
	return format(timestamp, timeFormat, { locale: dateLoc });
}

export function CalendarEventPopover({
	event,
	position,
	onClose,
	onDeleteVacation,
	locale,
}: EventPopoverProps) {
	const t = useTranslations("Calendar.popover");
	const tCal = useTranslations("Calendar");
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

	const typeLabel = t(event.type);

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
						{typeLabel}
					</span>
				</div>
				<Button
					variant="ghost"
					size="icon-sm"
					className="shrink-0 h-6 w-6"
					onClick={onClose}
					aria-label={t("close")}
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
							? tCal("counterparty.to", { name: event.counterpartyName })
							: tCal("counterparty.from", { name: event.counterpartyName })}
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
							{event.type === "vacation" ? t("start") : t("pickup")}
						</span>{" "}
						{formatEventDate(event.startDate, event.isAllDay, locale)}
					</span>
					<span>
						<span className="font-medium text-foreground">
							{event.type === "vacation" ? t("end") : t("return")}
						</span>{" "}
						{formatEventDate(event.endDate, event.isAllDay, locale)}
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
					{t("googleCal")}
				</Button>
				<Button
					variant="outline"
					size="sm"
					className="text-xs h-8 w-full"
					onClick={handleIcsDownload}
				>
					<Download className="h-3.5 w-3.5 shrink-0" />
					{t("downloadIcs")}
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
						{isDeleting ? t("deleting") : t("deleteVacation")}
					</Button>
				</div>
			)}
		</div>
	);
}
