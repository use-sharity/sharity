"use client";

import type {
	DatesSetArg,
	EventClickArg,
	EventInput,
} from "@fullcalendar/core";
import { useMutation, useQuery } from "convex/react";
import type { DateRange } from "react-day-picker";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useRef, useState } from "react";

import {
	AlertTriangle,
	ChevronLeft,
	ChevronRight,
	Palmtree,
} from "lucide-react";

import type { Locale } from "date-fns";
import { format } from "date-fns";
import { enUS, ru, vi } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { CalendarEvent } from "@/convex/items";

import { CalendarEventPopover } from "./calendar-event-popover";
import { UpNextSection } from "./up-next-section";

// FullCalendar wrapper — uses require() so plugins (plain JS objects) work with dynamic import
interface FullCalendarWrapperProps {
	events: EventInput[];
	onEventClick: (arg: EventClickArg) => void;
	onDatesSet: (arg: DatesSetArg) => void;
	selectable: boolean;
	calendarRef: React.RefObject<any>;
	locale: string;
}

function FullCalendarWrapperInner({
	events,
	onEventClick,
	onDatesSet,
	selectable,
	calendarRef,
	locale,
}: FullCalendarWrapperProps) {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const FullCalendarComponent = require("@fullcalendar/react").default;
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const dayGrid = require("@fullcalendar/daygrid").default;
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const interaction = require("@fullcalendar/interaction").default;

	return (
		<FullCalendarComponent
			ref={calendarRef}
			plugins={[dayGrid, interaction]}
			initialView="dayGridMonth"
			selectable={selectable}
			dayMaxEvents={false}
			events={events}
			eventClick={onEventClick}
			datesSet={onDatesSet}
			locale={locale}
			headerToolbar={false}
			height="auto"
			eventTimeFormat={{
				hour: "numeric",
				minute: "2-digit",
				meridiem: "short",
			}}
		/>
	);
}

const FullCalendarWrapper = dynamic(
	() => Promise.resolve(FullCalendarWrapperInner),
	{ ssr: false },
);

// One day in milliseconds
const ONE_DAY_MS = 86_400_000;

const DATE_LOCALES: Record<string, Locale> = { en: enUS, ru, vi };
function getDateLocale(locale: string): Locale {
	return DATE_LOCALES[locale] ?? enUS;
}

/** Format a Date as YYYY-MM-DD in local timezone (avoids UTC date shifting) */
function formatLocalDate(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function getInitialDateRange(): { startDate: number; endDate: number } {
	const now = new Date();
	const startDate = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
	const endDate = new Date(
		now.getFullYear(),
		now.getMonth() + 1,
		0,
		23,
		59,
		59,
		999,
	).getTime();
	return { startDate, endDate };
}

function toEventInputs(events: CalendarEvent[]): EventInput[] {
	return events.map((event) => {
		let backgroundColor: string;
		let borderColor: string;
		let textColor: string;

		if (event.type === "vacation") {
			backgroundColor = "#d0d0d0";
			borderColor = "#aaa";
			textColor = "#555";
		} else if (event.type === "lending") {
			// Teal — matches app primary
			backgroundColor = "#2d6a5e";
			borderColor = "#2d6a5e";
			textColor = "#ffffff";
		} else {
			// Amber — matches app accent
			backgroundColor = "#e8a438";
			borderColor = "#d4922e";
			textColor = "#3d2a0a";
		}

		const classNames: string[] = [];
		if (event.type === "vacation") {
			classNames.push("fc-vacation-event");
		}

		if (event.isAllDay) {
			// All-day: use YYYY-MM-DD strings in local time (not UTC, to avoid date shifting).
			// FullCalendar end is exclusive, so add 1 day.
			const startDate = new Date(event.startDate);
			const endDate = new Date(event.endDate + ONE_DAY_MS);
			const startStr = formatLocalDate(startDate);
			const endStr = formatLocalDate(endDate);

			return {
				id: event.id,
				title: event.title,
				start: startStr,
				end: endStr,
				allDay: true,
				backgroundColor,
				borderColor,
				textColor,
				classNames,
				extendedProps: { calendarEvent: event },
			};
		}

		// Timed events: use ISO strings
		return {
			id: event.id,
			title: event.title,
			start: new Date(event.startDate).toISOString(),
			end: new Date(event.endDate).toISOString(),
			allDay: false,
			backgroundColor,
			borderColor,
			textColor,
			classNames,
			extendedProps: { calendarEvent: event },
		};
	});
}

export function EnhancedCalendar() {
	const locale = useLocale();
	const t = useTranslations("Calendar");
	const dateLocale = getDateLocale(locale);
	const calendarRef = useRef<any>(null);
	const [calendarTitle, setCalendarTitle] = useState("");

	const [dateRange, setDateRange] = useState<{
		startDate: number;
		endDate: number;
	}>(getInitialDateRange);

	const [popover, setPopover] = useState<{
		event: CalendarEvent;
		position: { top: number; left: number };
	} | null>(null);

	const [showVacationForm, setShowVacationForm] = useState(false);
	const [vacationRange, setVacationRange] = useState<DateRange | undefined>();
	const [vacationNote, setVacationNote] = useState("");
	const [isSavingVacation, setIsSavingVacation] = useState(false);
	const addVacationRange = useMutation(api.items.addOwnerUnavailabilityRange);
	const deleteVacationRange = useMutation(
		api.items.deleteOwnerUnavailabilityRange,
	);

	const rawEvents = useQuery(api.items.getCalendarEvents, {
		startDate: dateRange.startDate,
		endDate: dateRange.endDate,
	});

	// Wide-range query for Up Next — independent of visible month.
	// useState keeps args referentially stable so Convex doesn't re-subscribe on every render.
	const [upNextRange] = useState(() => ({
		startDate: Date.now() - 30 * 86_400_000,
		endDate: Date.now() + 90 * 86_400_000,
	}));
	const upNextEvents = useQuery(api.items.getCalendarEvents, upNextRange);

	const calendarEvents: CalendarEvent[] = rawEvents ?? [];

	const vacationLabel = t("popover.vacation");
	const fcEvents = useMemo(
		() =>
			toEventInputs(
				calendarEvents.map((e) =>
					e.type === "vacation" ? { ...e, title: vacationLabel } : e,
				),
			),
		[calendarEvents, vacationLabel],
	);

	const handleEventClick = useCallback((arg: EventClickArg) => {
		const calendarEvent = arg.event.extendedProps
			.calendarEvent as CalendarEvent;
		const rect = arg.el.getBoundingClientRect();

		// Position popover below the clicked event (fixed positioning = viewport coords)
		const top = Math.min(rect.bottom + 4, window.innerHeight - 320);
		const left = Math.min(rect.left, window.innerWidth - 300);

		setPopover({ event: calendarEvent, position: { top, left } });
	}, []);

	const handleDatesSet = useCallback((arg: DatesSetArg) => {
		setDateRange({
			startDate: arg.start.getTime(),
			endDate: arg.end.getTime(),
		});
		setCalendarTitle(arg.view.title);
	}, []);

	const handlePrev = useCallback(() => {
		calendarRef.current?.getApi()?.prev();
	}, []);

	const handleNext = useCallback(() => {
		calendarRef.current?.getApi()?.next();
	}, []);

	const handleToday = useCallback(() => {
		calendarRef.current?.getApi()?.today();
	}, []);

	const handleClosePopover = useCallback(() => {
		setPopover(null);
	}, []);

	const handleDeleteVacation = useCallback(
		async (id: string) => {
			// The query prefixes vacation IDs with "vacation-" to avoid collisions
			const rawId = id.replace("vacation-", "");
			await deleteVacationRange({
				id: rawId as any,
			});
		},
		[deleteVacationRange],
	);

	const handleSaveVacation = useCallback(async () => {
		if (!vacationRange?.from || !vacationRange?.to) return;
		setIsSavingVacation(true);
		try {
			await addVacationRange({
				startDate: vacationRange.from.getTime(),
				endDate: vacationRange.to.getTime(),
				note: vacationNote.trim() || undefined,
			});
			setShowVacationForm(false);
			setVacationRange(undefined);
			setVacationNote("");
		} finally {
			setIsSavingVacation(false);
		}
	}, [vacationRange, vacationNote, addVacationRange]);

	const handleCancelVacation = useCallback(() => {
		setShowVacationForm(false);
		setVacationRange(undefined);
		setVacationNote("");
	}, []);

	const canSaveVacation = !!vacationRange?.from && !!vacationRange?.to;

	// Warn if any pickup/return falls within the vacation range
	const vacationConflicts = useMemo(() => {
		if (!vacationRange?.from || !vacationRange?.to) return [];
		const vacStart = vacationRange.from.getTime();
		const vacEnd = vacationRange.to.getTime();

		const conflicts: { itemName: string; type: "pickup" | "return" }[] = [];
		for (const event of calendarEvents) {
			if (event.type === "vacation") continue;
			const name = event.title.replace(/\s*[←→].*$/, "");
			if (event.startDate >= vacStart && event.startDate <= vacEnd) {
				conflicts.push({ itemName: name, type: "pickup" });
			}
			if (event.endDate >= vacStart && event.endDate <= vacEnd) {
				conflicts.push({ itemName: name, type: "return" });
			}
		}
		return conflicts;
	}, [vacationRange, calendarEvents]);

	return (
		<div>
			<UpNextSection events={upNextEvents ?? []} locale={locale} />

			<Dialog
				open={showVacationForm}
				onOpenChange={(open) => {
					if (!open) handleCancelVacation();
				}}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Palmtree className="h-4 w-4" />
							{t("vacation.title")}
						</DialogTitle>
						<DialogDescription>{t("vacation.description")}</DialogDescription>
					</DialogHeader>

					{vacationRange?.from && (
						<p className="text-sm font-medium">
							{format(vacationRange.from, "MMM d, yyyy", {
								locale: dateLocale,
							})}
							{vacationRange.to
								? ` – ${format(vacationRange.to, "MMM d, yyyy", { locale: dateLocale })}`
								: ` – ${t("vacation.selectEndDate")}`}
						</p>
					)}

					<Calendar
						mode="range"
						selected={vacationRange}
						onSelect={setVacationRange}
						numberOfMonths={1}
						disabled={{ before: new Date() }}
						showOutsideDays={false}
					/>
					<Input
						placeholder={t("vacation.note")}
						value={vacationNote}
						onChange={(e) => setVacationNote(e.target.value)}
					/>
					{vacationConflicts.length > 0 && (
						<div className="flex gap-2 rounded-md bg-yellow-50/50 border border-yellow-200 p-3 text-sm text-foreground">
							<AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-yellow-500" />
							<div>
								<p className="font-medium">{t("vacation.conflict")}</p>
								<ul className="mt-1 text-xs space-y-0.5">
									{vacationConflicts.map((c, i) => (
										<li key={i}>
											{c.type === "pickup"
												? t("vacation.conflictPickup", { name: c.itemName })
												: t("vacation.conflictReturn", { name: c.itemName })}
										</li>
									))}
								</ul>
							</div>
						</div>
					)}
					<div className="flex gap-2 justify-end">
						<Button
							variant="outline"
							size="sm"
							onClick={handleCancelVacation}
							disabled={isSavingVacation}
						>
							{t("vacation.cancel")}
						</Button>
						<Button
							size="sm"
							onClick={handleSaveVacation}
							disabled={!canSaveVacation || isSavingVacation}
						>
							{isSavingVacation ? t("vacation.saving") : t("vacation.save")}
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			<Card>
				<CardContent className="p-5 md:p-6">
					{/* Toolbar */}
					<div className="flex flex-wrap items-center gap-2 mb-3">
						<Button variant="outline" size="icon-sm" onClick={handlePrev}>
							<ChevronLeft className="h-4 w-4" />
						</Button>
						<span className="text-lg font-bold capitalize">
							{calendarTitle}
						</span>
						<Button variant="outline" size="icon-sm" onClick={handleNext}>
							<ChevronRight className="h-4 w-4" />
						</Button>
						<Button variant="outline" size="sm" onClick={handleToday}>
							{t("today")}
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="gap-1.5"
							onClick={() => setShowVacationForm(true)}
						>
							<Palmtree className="h-4 w-4" />
							<span className="hidden sm:inline">{t("addVacation")}</span>
						</Button>
					</div>

					<FullCalendarWrapper
						events={fcEvents}
						onEventClick={handleEventClick}
						onDatesSet={handleDatesSet}
						selectable={false}
						calendarRef={calendarRef}
						locale={locale}
					/>
				</CardContent>
			</Card>

			{popover && (
				<CalendarEventPopover
					event={popover.event}
					position={popover.position}
					onClose={handleClosePopover}
					onDeleteVacation={handleDeleteVacation}
					locale={locale}
				/>
			)}
		</div>
	);
}
