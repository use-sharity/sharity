import { format } from "date-fns";

interface ExportEventParams {
  title: string;
  startDate: number;
  endDate: number;
  isAllDay: boolean;
  description?: string;
}

/**
 * Build a Google Calendar "create event" URL.
 * Timed events use YYYYMMDDTHHmmss format.
 * All-day events use YYYYMMDD format with exclusive end date (next day).
 */
export function buildGoogleCalendarUrl(params: ExportEventParams): string {
  const { title, startDate, endDate, isAllDay, description } = params;

  const startMs = startDate;
  const endMs = isAllDay ? endDate + 86400000 : endDate; // Add 1 day for all-day events

  let dates: string;
  if (isAllDay) {
    dates = `${format(startMs, "yyyyMMdd")}/${format(endMs, "yyyyMMdd")}`;
  } else {
    const startStr = format(startMs, "yyyyMMdd'T'HHmmss");
    const endStr = format(endMs, "yyyyMMdd'T'HHmmss");
    dates = `${startStr}/${endStr}`;
  }

  const params_obj = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates,
  });

  if (description) {
    params_obj.append("details", description);
  }

  return `https://calendar.google.com/calendar/render?${params_obj.toString()}`;
}

/**
 * Generate an iCalendar (.ics) string and trigger a browser download.
 * All-day events use VALUE=DATE format with exclusive end date.
 */
export function downloadIcsFile(params: ExportEventParams): void {
  const { title, startDate, endDate, isAllDay, description } = params;

  // Generate unique UID based on title and start date
  const uid = `${title.replace(/\s+/g, "-")}-${startDate}@sharity.local`;

  // Format dates for iCalendar
  let dtStart: string;
  let dtEnd: string;

  if (isAllDay) {
    dtStart = `DTSTART;VALUE=DATE:${format(startDate, "yyyyMMdd")}`;
    // All-day events: end date is exclusive (next day)
    dtEnd = `DTEND;VALUE=DATE:${format(endDate + 86400000, "yyyyMMdd")}`;
  } else {
    dtStart = `DTSTART:${format(startDate, "yyyyMMdd'T'HHmmss")}`;
    dtEnd = `DTEND:${format(endDate, "yyyyMMdd'T'HHmmss")}`;
  }

  // Create iCalendar content
  const now = format(new Date(), "yyyyMMdd'T'HHmmss'Z'");
  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sharity//Calendar Event//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    dtStart,
    dtEnd,
    `SUMMARY:${title}`,
    ...(description ? [`DESCRIPTION:${description}`] : []),
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  // Create blob and trigger download
  const blob = new Blob([icsContent], {
    type: "text/calendar;charset=utf-8",
  });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `${title}.ics`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
