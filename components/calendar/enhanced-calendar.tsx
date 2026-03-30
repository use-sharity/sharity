"use client";

import type {
	DateSelectArg,
	DatesSetArg,
	EventClickArg,
	EventInput,
} from "@fullcalendar/core";
import { useQuery } from "convex/react";
import dynamic from "next/dynamic";
import { useLocale } from "next-intl";
import { useCallback, useMemo, useState } from "react";

import { OwnerUnavailabilityButton } from "@/components/owner-unavailability-button";
import { api } from "@/convex/_generated/api";
import type { CalendarEvent } from "@/convex/items";

import { CalendarEventPopover } from "./calendar-event-popover";
import { UpNextSection } from "./up-next-section";

// FullCalendar wrapper — uses require() so plugins (plain JS objects) work with dynamic import
interface FullCalendarWrapperProps {
	events: EventInput[];
	onEventClick: (arg: EventClickArg) => void;
	onSelect: (arg: DateSelectArg) => void;
	onDatesSet: (arg: DatesSetArg) => void;
}

function FullCalendarWrapperInner({
	events,
	onEventClick,
	onSelect,
	onDatesSet,
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
			selectable={true}
			selectMirror={true}
			dayMaxEvents={3}
			events={events}
			eventClick={onEventClick}
			select={onSelect}
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

	const [vacationDialog, setVacationDialog] = useState<{
		startDate: Date;
		endDate: Date;
	} | null>(null);

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

	const handleSelect = useCallback((arg: DateSelectArg) => {
		const startDate = arg.start;
		// FullCalendar end is exclusive, subtract 1 ms
		const endDate = new Date(arg.end.getTime() - 1);
		setVacationDialog({ startDate, endDate });
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

	const handleCloseVacationDialog = useCallback((open: boolean) => {
		if (!open) {
			setVacationDialog(null);
		}
	}, []);

	return (
		<div>
			<UpNextSection events={calendarEvents} locale={locale} />

			<FullCalendarWrapper
				events={fcEvents}
				onEventClick={handleEventClick}
				onSelect={handleSelect}
				onDatesSet={handleDatesSet}
			/>

			{popover && (
				<CalendarEventPopover
					event={popover.event}
					position={popover.position}
					onClose={handleClosePopover}
					locale={locale}
				/>
			)}

			{vacationDialog && (
				<OwnerUnavailabilityButton
					dialogOnly
					open={true}
					onOpenChange={handleCloseVacationDialog}
					initialStartDate={vacationDialog.startDate}
					initialEndDate={vacationDialog.endDate}
				/>
			)}
		</div>
	);
}
