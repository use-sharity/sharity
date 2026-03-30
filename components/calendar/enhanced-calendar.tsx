"use client";

import type {
	DatesSetArg,
	EventClickArg,
	EventInput,
} from "@fullcalendar/core";
import { useMutation, useQuery } from "convex/react";
import type { DateRange } from "react-day-picker";
import dynamic from "next/dynamic";
import { useLocale } from "next-intl";
import { useCallback, useMemo, useState } from "react";

import { Palmtree } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
}

function FullCalendarWrapperInner({
	events,
	onEventClick,
	onDatesSet,
	selectable,
}: FullCalendarWrapperProps) {
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const FullCalendarComponent = require("@fullcalendar/react").default;
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const dayGrid = require("@fullcalendar/daygrid").default;
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const interaction = require("@fullcalendar/interaction").default;

	return (
		<FullCalendarComponent
			plugins={[dayGrid, interaction]}
			initialView="dayGridMonth"
			selectable={selectable}
			dayMaxEvents={3}
			events={events}
			eventClick={onEventClick}
			datesSet={onDatesSet}
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
	{ ssr: false },
);

// One day in milliseconds
const ONE_DAY_MS = 86_400_000;

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
		const textColor = event.type === "vacation" ? "#ef4444" : "#ffffff";

		if (event.type === "lending") {
			backgroundColor = "#6366f1";
			borderColor = "#6366f1";
		} else if (event.type === "borrowing") {
			backgroundColor = "#8b5cf6";
			borderColor = "#8b5cf6";
		} else {
			// vacation
			backgroundColor = "rgba(239, 68, 68, 0.25)";
			borderColor = "#ef4444";
		}

		const classNames: string[] = [];
		if (event.needsAction != null) {
			classNames.push("fc-event-needs-action");
		}

		if (event.isAllDay) {
			// All-day: use YYYY-MM-DD strings. FullCalendar end is exclusive, so add 1 day.
			const startDate = new Date(event.startDate);
			const endDate = new Date(event.endDate + ONE_DAY_MS);
			const startStr = startDate.toISOString().slice(0, 10);
			const endStr = endDate.toISOString().slice(0, 10);

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

	const calendarEvents: CalendarEvent[] = rawEvents ?? [];

	const fcEvents = useMemo(
		() => toEventInputs(calendarEvents),
		[calendarEvents],
	);

	const handleEventClick = useCallback((arg: EventClickArg) => {
		const calendarEvent = arg.event.extendedProps
			.calendarEvent as CalendarEvent;
		const rect = arg.el.getBoundingClientRect();

		// Position popover below and to the right of the clicked event
		const top = rect.bottom + window.scrollY + 4;
		const left = Math.min(rect.left + window.scrollX, window.innerWidth - 300);

		setPopover({ event: calendarEvent, position: { top, left } });
	}, []);

	const handleDatesSet = useCallback((arg: DatesSetArg) => {
		setDateRange({
			startDate: arg.start.getTime(),
			endDate: arg.end.getTime(),
		});
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

	return (
		<div>
			<UpNextSection events={calendarEvents} locale={locale} />

			<div className="flex justify-end mb-3">
				{!showVacationForm && (
					<Button
						variant="outline"
						size="sm"
						className="gap-1.5"
						onClick={() => setShowVacationForm(true)}
					>
						<Palmtree className="h-4 w-4" />
						Add Vacation
					</Button>
				)}
			</div>

			{showVacationForm && (
				<div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
					<div className="flex items-center gap-2 mb-3">
						<Palmtree className="h-4 w-4 text-red-600" />
						<span className="font-medium text-sm">Add Vacation</span>
					</div>
					<Calendar
						mode="range"
						selected={vacationRange}
						onSelect={setVacationRange}
						numberOfMonths={2}
						disabled={{ before: new Date() }}
					/>
					<Input
						placeholder="Note (optional)"
						value={vacationNote}
						onChange={(e) => setVacationNote(e.target.value)}
						className="mt-3 mb-3"
					/>
					<div className="flex gap-2 justify-end">
						<Button
							variant="outline"
							size="sm"
							onClick={handleCancelVacation}
							disabled={isSavingVacation}
						>
							Cancel
						</Button>
						<Button
							size="sm"
							onClick={handleSaveVacation}
							disabled={!canSaveVacation || isSavingVacation}
						>
							{isSavingVacation ? "Saving..." : "Save"}
						</Button>
					</div>
				</div>
			)}

			<FullCalendarWrapper
				events={fcEvents}
				onEventClick={handleEventClick}
				onDatesSet={handleDatesSet}
				selectable={false}
			/>

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
