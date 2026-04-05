"use client";

import * as React from "react";
import type { DateRange } from "react-day-picker";
import type { Id } from "@/convex/_generated/dataModel";
import { Calendar } from "@/components/ui/calendar";
import { useClaimItem } from "@/hooks/use-claim-item";

type CalendarProps = React.ComponentProps<typeof Calendar>;
type BorrowerCalendarProps = Omit<
  CalendarProps,
  "mode" | "selected" | "onSelect"
> & {
  mode: "range";
  selected: DateRange | undefined;
  onSelect: (range: DateRange | undefined) => void;
};
type OwnerCalendarProps = Omit<
  CalendarProps,
  "mode" | "selected" | "onSelect" | "required"
> & {
  mode: "single";
  // Owner calendar is view-only: we don't maintain a selected day.
  // Explicitly opt out of "required single" DayPicker props.
  required: false;
  selected: undefined;
};

type BorrowerMonths = 1 | 2 | "responsive";

type AvailabilityRange = { startDate: number; endDate: number };

export type BorrowerCalendarConfig = {
  mode: "borrower";
  itemId: Id<"items">;
  months: BorrowerMonths;
  showMyRequestModifiers: boolean;
};

type OwnerRequestBase = {
  _id: Id<"claims">;
  status: "pending" | "approved" | "rejected" | "expired";
  startDate: number;
  endDate: number;
};

export type OwnerCalendarConfig<TRequest extends OwnerRequestBase> = {
  mode: "owner";
  itemId: Id<"items">;
  requests: TRequest[];
  months: 2;
  onFocusClaim: (claimId: Id<"claims">) => void;
};

export type BorrowerCalendarState = {
  mode: "borrower";
  date: DateRange | undefined;
  setDate: (date: DateRange | undefined) => void;
  numberOfMonths: number;
  calendarProps: BorrowerCalendarProps;
  hoveredClaimId: Id<"claims"> | null;
  isSubmitting: boolean;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  myRequests: ReturnType<typeof useClaimItem>["myRequests"];
  availability: AvailabilityRange[] | undefined;
  cancelRequest: ReturnType<typeof useClaimItem>["cancelRequest"];
  requestItem: ReturnType<typeof useClaimItem>["requestItem"];
  requestItemAt: ReturnType<typeof useClaimItem>["requestItemAt"];
  disabledDates: ReturnType<typeof useClaimItem>["disabledDates"];
};

export type OwnerCalendarState = {
  mode: "owner";
  hoveredClaimId: Id<"claims"> | null;
  calendarProps: OwnerCalendarProps;
};

const EMPTY_OWNER_REQUESTS: OwnerRequestBase[] = [];

function toDayRange(req: { startDate: number; endDate: number }): {
  from: Date;
  to: Date;
} {
  const endInclusive = Math.max(req.startDate, req.endDate - 1);
  return { from: new Date(req.startDate), to: new Date(endInclusive) };
}

function isWithinClaimRange(
  day: Date,
  req: { startDate: number; endDate: number },
): boolean {
  const t = day.getTime();
  return t >= req.startDate && t < req.endDate;
}

function startOfLocalDayAt(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function toDisabledDayRange(
  range: AvailabilityRange,
): { from: Date; to: Date } | null {
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const ONE_DAY_MS = 24 * ONE_HOUR_MS;

  const startDay = startOfLocalDayAt(range.startDate);
  const endDay = startOfLocalDayAt(range.endDate);
  const isAligned = range.startDate === startDay && range.endDate === endDay;
  const isAtLeastOneDay = range.endDate - range.startDate >= ONE_DAY_MS;
  if (!isAligned || !isAtLeastOneDay) return null;

  const endInclusive = Math.max(range.startDate, range.endDate - 1);
  return { from: new Date(range.startDate), to: new Date(endInclusive) };
}

function useResponsiveMonths(enabled: boolean): number {
  const [numberOfMonths, setNumberOfMonths] = React.useState(1);

  React.useEffect(() => {
    if (!enabled) return;

    setNumberOfMonths(window.innerWidth >= 768 ? 2 : 1);

    const updateMonths = () => {
      setNumberOfMonths(window.innerWidth >= 768 ? 2 : 1);
    };
    window.addEventListener("resize", updateMonths);
    return () => window.removeEventListener("resize", updateMonths);
  }, [enabled]);

  return numberOfMonths;
}

export function useItemCalendar(
  config: BorrowerCalendarConfig,
): BorrowerCalendarState;
export function useItemCalendar<TRequest extends OwnerRequestBase>(
  config: OwnerCalendarConfig<TRequest>,
): OwnerCalendarState;
export function useItemCalendar<TRequest extends OwnerRequestBase>(
  config: BorrowerCalendarConfig | OwnerCalendarConfig<TRequest>,
): BorrowerCalendarState | OwnerCalendarState {
  const {
    requestItem,
    requestItemAt,
    disabledDates,
    isSubmitting,
    isAuthenticated,
    isAuthLoading,
    myRequests,
    availability,
    cancelRequest,
  } = useClaimItem(config.itemId);

  const [date, setDate] = React.useState<DateRange | undefined>(undefined);

  const borrowerMonths: BorrowerMonths =
    config.mode === "borrower" ? config.months : 1;
  const showMyRequestModifiers =
    config.mode === "borrower" && config.showMyRequestModifiers;

  const responsiveMonths = useResponsiveMonths(borrowerMonths === "responsive");
  const numberOfMonths =
    borrowerMonths === "responsive" ? responsiveMonths : borrowerMonths;

  const myPendingRanges = React.useMemo(() => {
    if (!showMyRequestModifiers) return undefined;
    return (myRequests ?? [])
      .filter((r) => r.status === "pending")
      .map(toDayRange);
  }, [showMyRequestModifiers, myRequests]);

  const myApprovedRanges = React.useMemo(() => {
    if (!showMyRequestModifiers) return undefined;
    return (myRequests ?? [])
      .filter((r) => r.status === "approved")
      .map(toDayRange);
  }, [showMyRequestModifiers, myRequests]);

  const activeBorrowerRequests = React.useMemo(() => {
    if (config.mode !== "borrower") return [];
    return (myRequests ?? []).filter(
      (r) => r.status === "pending" || r.status === "approved",
    );
  }, [config.mode, myRequests]);

  const disabledDayRanges = React.useMemo(() => {
    if (config.mode !== "borrower") return [];
    return (availability ?? [])
      .map(toDisabledDayRange)
      .filter((v): v is { from: Date; to: Date } => v !== null);
  }, [config.mode, availability]);

  const borrowerCalendarProps: BorrowerCalendarProps = {
    mode: "range",
    selected: date,
    onSelect: setDate,
    disabled: [...disabledDates, ...disabledDayRanges],
    numberOfMonths,
    onDayMouseEnter: (day) => {
      if (config.mode !== "borrower") return;
      const match = activeBorrowerRequests.find((r) =>
        isWithinClaimRange(day, r),
      );
      setHoveredClaimId(match?._id ?? null);
    },
    onDayMouseLeave: () => setHoveredClaimId(null),
    modifiers:
      showMyRequestModifiers && myPendingRanges && myApprovedRanges
        ? { myPending: myPendingRanges, myApproved: myApprovedRanges }
        : undefined,
    modifiersClassNames: showMyRequestModifiers
      ? {
          myPending:
            "bg-amber-100 text-amber-950 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-100",
          myApproved:
            "!opacity-100 bg-emerald-100 text-emerald-950 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100",
        }
      : undefined,
  };

  const [hoveredClaimId, setHoveredClaimId] =
    React.useState<Id<"claims"> | null>(null);

  const ownerRequests =
    config.mode === "owner" ? config.requests : EMPTY_OWNER_REQUESTS;
  const onFocusClaim =
    config.mode === "owner" ? config.onFocusClaim : undefined;
  const isOwnerMode = config.mode === "owner";

  const pendingRanges = React.useMemo(() => {
    if (!isOwnerMode) return [];
    return ownerRequests.filter((r) => r.status === "pending").map(toDayRange);
  }, [isOwnerMode, ownerRequests]);

  const approvedRanges = React.useMemo(() => {
    if (!isOwnerMode) return [];
    return ownerRequests.filter((r) => r.status === "approved").map(toDayRange);
  }, [isOwnerMode, ownerRequests]);

  const rejectedRanges = React.useMemo(() => {
    if (!isOwnerMode) return [];
    return ownerRequests.filter((r) => r.status === "rejected").map(toDayRange);
  }, [isOwnerMode, ownerRequests]);

  const ownerCalendarProps: OwnerCalendarProps = {
    mode: "single",
    required: false,
    selected: undefined,
    numberOfMonths: isOwnerMode ? config.months : 2,
    disabled: disabledDates,
    onDayMouseEnter: (day) => {
      if (!isOwnerMode) return;
      const match = ownerRequests.find((r) => isWithinClaimRange(day, r));
      setHoveredClaimId(match?._id ?? null);
    },
    onDayMouseLeave: () => setHoveredClaimId(null),
    onDayClick: (day) => {
      if (!isOwnerMode || !onFocusClaim) return;
      const match = ownerRequests.find((r) => isWithinClaimRange(day, r));
      if (match) onFocusClaim(match._id);
    },
    modifiers: {
      pending: pendingRanges,
      approved: approvedRanges,
      rejected: rejectedRanges,
    },
    modifiersClassNames: {
      pending:
        "bg-amber-100 text-amber-950 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-100",
      approved:
        "bg-emerald-100 text-emerald-950 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100",
      rejected:
        "bg-rose-100 text-rose-950 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-100",
    },
  };

  if (config.mode === "borrower") {
    return {
      mode: "borrower",
      date,
      setDate,
      numberOfMonths,
      calendarProps: borrowerCalendarProps,
      isSubmitting,
      isAuthenticated,
      isAuthLoading,
      myRequests,
      availability,
      cancelRequest,
      requestItem,
      requestItemAt,
      disabledDates,
      hoveredClaimId,
    };
  }

  return {
    mode: "owner",
    hoveredClaimId,
    calendarProps: ownerCalendarProps,
  };
}
