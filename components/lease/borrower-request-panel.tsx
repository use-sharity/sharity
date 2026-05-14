"use client";

import * as React from "react";
import { useMutation } from "convex/react";
import { CalendarDays, Loader2, MessageCircle } from "lucide-react";
import { AvailabilityToggle } from "@/components/notifications/availability-toggle";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { ItemCalendar } from "@/components/item-calendar";
import { LeaseProposeIntradayDialog } from "@/components/lease/lease-propose-intraday-dialog";
import {
  useItemCalendar,
  type BorrowerCalendarState,
} from "@/hooks/use-item-calendar";
import { useClaimItem } from "@/hooks/use-claim-item";
import { useTrackedPickup } from "@/hooks/use-tracked-pickup";
import type { Doc } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { LeaseClaimCard } from "./lease-claim-card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatIntradayRangeLabel(range: {
  startAt: number;
  endAt: number;
}): string {
  const startHour = new Date(range.startAt).getHours();
  const endHour = new Date(range.endAt).getHours();
  return `${pad2(startHour)}:00–${pad2(endHour)}:00`;
}

function formatDateRangeLabel(range: {
  startDate: number;
  endDate: number;
}): string {
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  });
  const start = formatter.format(new Date(range.startDate));
  const endInclusive = Math.max(range.startDate, range.endDate - 1);
  const end = formatter.format(new Date(endInclusive));
  return start === end ? start : `${start}-${end}`;
}

function isActiveRequest(request: Doc<"claims">): boolean {
  if (request.status === "pending") return !request.expiredAt;
  if (request.status !== "approved") return false;

  return !request.returnedAt && !request.transferredAt && !request.expiredAt;
}

type BorrowerRequestContextValue = {
  item: Doc<"items">;
  calendar: BorrowerCalendarState;
  isSubmitting: boolean;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  myRequests: Doc<"claims">[] | undefined;
  cancelRequest: (claimId: Doc<"claims">["_id"]) => Promise<void>;
  intradayRange: { startAt: number; endAt: number } | null;
  isIntradayRequired: boolean;
  intradayDialogOpen: boolean;
  intradayFixedDate: Date | null;
  onIntradayDialogOpenChange: (open: boolean) => void;
  onConfirmIntraday: (startAt: number, endAt: number) => Promise<void>;
  onClaim: () => void;
  requestBlockedReason?: string;
};

const BorrowerRequestContext =
  React.createContext<BorrowerRequestContextValue | null>(null);

function useBorrowerRequestContext(): BorrowerRequestContextValue {
  const ctx = React.useContext(BorrowerRequestContext);
  if (!ctx) {
    throw new Error(
      "BorrowerRequestContext is missing. Wrap with BorrowerRequestProvider.",
    );
  }
  return ctx;
}

export function BorrowerRequestProvider(props: {
  item: Doc<"items">;
  children: React.ReactNode;
}) {
  const { item, children } = props;
  const t = useTranslations("BorrowerRequest");
  const calendar = useItemCalendar({
    mode: "borrower",
    itemId: item._id,
    months: 2,
    showMyRequestModifiers: true,
  });

  const [intradayRange, setIntradayRange] = React.useState<{
    startAt: number;
    endAt: number;
  } | null>(null);
  const [intradayDialogOpen, setIntradayDialogOpen] = React.useState(false);
  const [intradayFixedDate, setIntradayFixedDate] = React.useState<Date | null>(
    null,
  );

  const isIntradayRequired = Boolean(
    calendar.date?.from &&
      calendar.date?.to &&
      isSameDay(calendar.date.from, calendar.date.to),
  );

  const hasOverlap = (
    a: { startDate: number; endDate: number },
    b: { startDate: number; endDate: number },
  ): boolean => a.startDate < b.endDate && a.endDate > b.startDate;

  const selectionKey =
    calendar.date?.from && calendar.date?.to
      ? `${calendar.date.from.getTime()}-${calendar.date.to.getTime()}`
      : null;
  const lastSelectionKeyRef = React.useRef<string | null>(null);

  const selectedDayRange = React.useMemo(() => {
    if (!calendar.date?.from || !calendar.date?.to) return null;
    if (isSameDay(calendar.date.from, calendar.date.to)) return null;
    return {
      startDate: calendar.date.from.getTime(),
      endDate: calendar.date.to.getTime(),
    };
  }, [calendar.date]);

  const requestBlockedReason = React.useMemo(() => {
    if (!selectedDayRange) return undefined;

    const unavailableRange = (calendar.availability ?? []).find((range) =>
      hasOverlap(selectedDayRange, range),
    );
    if (unavailableRange) {
      if (unavailableRange.kind === "missing") {
        return t("errors.blockedByMissingItem", {
          range: formatDateRangeLabel(unavailableRange),
        });
      }
      return t("errors.blockedByUnavailableRange", {
        range: formatDateRangeLabel(unavailableRange),
      });
    }

    const overlapsMyActiveRequest = (calendar.myRequests ?? []).some(
      (request) => {
        if (request.status !== "pending" && request.status !== "approved") {
          return false;
        }
        if (
          request.status === "approved" &&
          (request.returnedAt || request.transferredAt || request.expiredAt)
        ) {
          return false;
        }
        return hasOverlap(selectedDayRange, request);
      },
    );

    return overlapsMyActiveRequest ? t("errors.overlappingRequest") : undefined;
  }, [calendar.availability, calendar.myRequests, selectedDayRange, t]);

  React.useEffect(() => {
    if (selectionKey === lastSelectionKeyRef.current) return;
    lastSelectionKeyRef.current = selectionKey;

    setIntradayRange(null);
    setIntradayDialogOpen(false);
    setIntradayFixedDate(null);

    if (calendar.date?.from && calendar.date?.to) {
      if (isSameDay(calendar.date.from, calendar.date.to)) {
        setIntradayFixedDate(calendar.date.from);
      }
    }
  }, [calendar.date, selectionKey]);

  const onConfirmIntraday = async (startAt: number, endAt: number) => {
    if (!intradayFixedDate) {
      throw new Error("Missing date for intraday selection");
    }

    const now = Date.now();
    const HOUR_MS = 60 * 60 * 1000;
    const currentHourStart = Math.floor(now / HOUR_MS) * HOUR_MS;
    // Mirror backend intraday rule: window is valid as long as it hasn't
    // fully passed yet (end must be in the future) and the start hour is
    // not earlier than the current hour. This allows 21–23 at 21:05, but
    // disallows 20–23 at 21:05.
    if (endAt <= now) {
      toast.error(t("errors.startTimeFuture"));
      throw new Error("Start time must be in the future");
    }
    if (startAt < currentHourStart) {
      toast.error(t("errors.startTimeFuture"));
      throw new Error("Start time must be in the future");
    }
    if (endAt <= startAt) {
      toast.error(t("errors.endTimeAfterStart"));
      throw new Error("End time must be after start time");
    }

    const overlaps = (calendar.availability ?? []).some((r) =>
      hasOverlap(
        { startDate: startAt, endDate: endAt },
        { startDate: r.startDate, endDate: r.endDate },
      ),
    );
    if (overlaps) {
      toast.error(t("errors.hoursNotAvailable"));
      throw new Error("Selected hours are not available");
    }

    setIntradayRange({ startAt, endAt });
    setIntradayDialogOpen(false);
  };

  const onClaim = () => {
    if (requestBlockedReason) {
      toast.error(requestBlockedReason);
      return;
    }

    if (isIntradayRequired) {
      if (!intradayRange) {
        setIntradayDialogOpen(true);
        return;
      }
      calendar.requestItemAt(intradayRange.startAt, intradayRange.endAt, () => {
        setIntradayRange(null);
        setIntradayDialogOpen(false);
        setIntradayFixedDate(null);
        calendar.setDate(undefined);
      });
      return;
    }

    if (!calendar.date?.from || !calendar.date?.to) return;
    calendar.requestItem(calendar.date.from, calendar.date.to, () => {
      setIntradayRange(null);
      setIntradayDialogOpen(false);
      setIntradayFixedDate(null);
      calendar.setDate(undefined);
    });
  };

  return (
    <BorrowerRequestContext.Provider
      value={{
        item,
        calendar,
        isSubmitting: calendar.isSubmitting,
        isAuthenticated: calendar.isAuthenticated,
        isAuthLoading: calendar.isAuthLoading,
        myRequests: calendar.myRequests,
        cancelRequest: calendar.cancelRequest,
        intradayRange,
        isIntradayRequired,
        intradayDialogOpen,
        intradayFixedDate,
        onIntradayDialogOpenChange: setIntradayDialogOpen,
        onConfirmIntraday,
        onClaim,
        requestBlockedReason,
      }}
    >
      {children}
    </BorrowerRequestContext.Provider>
  );
}

export function BorrowerRequestCalendar(props: { className?: string }) {
  const { className } = props;
  const {
    calendar,
    intradayRange,
    intradayDialogOpen,
    intradayFixedDate,
    onIntradayDialogOpenChange,
    onConfirmIntraday,
  } = useBorrowerRequestContext();
  const [isIntradayBusy, setIsIntradayBusy] = React.useState(false);
  const t = useTranslations("BorrowerRequest");

  return (
    <>
      <ItemCalendar {...calendar.calendarProps} className={className} />
      {intradayFixedDate ? (
        <div className="mt-3">
          <LeaseProposeIntradayDialog
            title={t("selectHoursTitle")}
            description={t("selectHoursDescription")}
            triggerLabel={
              intradayRange
                ? t("changeHours", {
                    range: formatIntradayRangeLabel(intradayRange),
                  })
                : t("selectHours")
            }
            triggerVariant="outline"
            triggerSize="sm"
            triggerClassName="w-full h-8"
            confirmLabel={t("saveHours")}
            cancelLabel={t("cancel")}
            fixedDate={intradayFixedDate}
            disabled={calendar.isSubmitting || isIntradayBusy}
            open={intradayDialogOpen}
            onOpenChange={onIntradayDialogOpenChange}
            onBusyChange={setIsIntradayBusy}
            onConfirm={async (startAt, endAt) => {
              await onConfirmIntraday(startAt, endAt);
            }}
          />
        </div>
      ) : null}
    </>
  );
}

export function BorrowerRequestActions() {
  const {
    item,
    isSubmitting,
    isAuthenticated,
    isAuthLoading,
    myRequests,
    cancelRequest,
    onClaim,
    calendar,
    requestBlockedReason,
  } = useBorrowerRequestContext();
  const t = useTranslations("BorrowerRequest");

  const markPickedUp = useTrackedPickup();
  const markReturned = useMutation(api.items.markReturned);
  const startConversation = useMutation(api.messaging.startConversation);
  const router = useRouter();

  const activeRequests = React.useMemo(
    () => (myRequests ?? []).filter(isActiveRequest),
    [myRequests],
  );

  const hasOpenWorkflow = React.useMemo(() => {
    return activeRequests.length > 0;
  }, [activeRequests]);

  const approvedClaim = React.useMemo(() => {
    return activeRequests.find((req) => req.status === "approved");
  }, [activeRequests]);

  const requestActionHint = React.useMemo(() => {
    if (hasOpenWorkflow) return t("requestLockedOpenWorkflow");
    if (!isAuthenticated) return t("signInToRequest");
    if (requestBlockedReason) return requestBlockedReason;
    if (!calendar.date?.from || !calendar.date?.to) {
      return t("selectDatesToRequest");
    }
    return t("readyToRequest");
  }, [
    calendar.date?.from,
    calendar.date?.to,
    hasOpenWorkflow,
    isAuthenticated,
    requestBlockedReason,
    t,
  ]);

  const handleMessageOwner = async () => {
    const conversationId = await startConversation({
      otherUserId: item.ownerId,
      itemId: item._id,
      claimId: approvedClaim?._id,
    });
    router.push(`/chat/${conversationId}`);
  };

  return (
    <>
      <div className="flex flex-col gap-3">
        <div
          className={cn(
            "grid w-full grid-cols-1 gap-3",
            hasOpenWorkflow ? "sm:grid-cols-1" : "sm:grid-cols-3",
          )}
        >
          <Button
            variant={approvedClaim ? "default" : "outline"}
            className="h-10 w-full gap-2"
            onClick={handleMessageOwner}
            disabled={!isAuthenticated || isAuthLoading}
          >
            <MessageCircle className="h-4 w-4" />
            {t("messageOwner")}
          </Button>
          {!hasOpenWorkflow ? (
            <Button
              className="h-10 w-full"
              onClick={onClaim}
              disabled={
                !calendar.date?.from ||
                !calendar.date?.to ||
                isSubmitting ||
                !isAuthenticated ||
                isAuthLoading ||
                !!requestBlockedReason
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                  {t("requesting")}
                </>
              ) : (
                t("requestToBorrow")
              )}
            </Button>
          ) : null}
          {!hasOpenWorkflow && (
            <AvailabilityToggle id={item._id} className="w-full" />
          )}
        </div>
        {!isAuthenticated && (
          <span className="text-sm text-muted-foreground">
            {t("signInToRequest")}
          </span>
        )}
        {isAuthenticated ? (
          <span
            className={cn(
              "text-sm",
              requestBlockedReason
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            {requestActionHint}
          </span>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {t("intradayNote")}
        </span>
      </div>

      {isAuthenticated && activeRequests.length > 0 && (
        <div className="mt-6">
          <div className="mb-3">
            <h4 className="font-medium">{t("yourRequests")}</h4>
          </div>
          <div className="space-y-4">
            {activeRequests.map((claim) => (
              <div
                key={claim._id}
                className={cn(
                  calendar.hoveredClaimId === claim._id &&
                    "ring-2 ring-primary rounded-lg",
                )}
              >
                <LeaseClaimCard
                  itemId={item._id}
                  claim={claim}
                  viewerRole="borrower"
                  isGiveaway={false}
                  coordinationAddress={item.location?.address}
                  ownerId={item.ownerId}
                  cancelClaim={async ({ claimId }) =>
                    await cancelRequest(claimId)
                  }
                  markPickedUp={markPickedUp}
                  markReturned={markReturned}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// Handles borrower availability selection and request actions for a single item.
export function BorrowerRequestPanel({
  item,
  fullWidth,
  embedded,
}: {
  item: Doc<"items">;
  fullWidth?: boolean;
  embedded?: boolean;
}) {
  const t = useTranslations("BorrowerRequest");

  if (item.giveaway) {
    return (
      <GiveawayBorrowerRequestPanel
        item={item}
        fullWidth={fullWidth}
        embedded={embedded}
      />
    );
  }
  return (
    <BorrowerRequestProvider item={item}>
      {embedded ? (
        <BorrowerRequestCalendar className="mx-auto" />
      ) : (
        <>
          <BorrowerRequestActions />
          <details
            className={cn(
              "mt-4 rounded-lg border bg-white p-4",
              fullWidth ? undefined : "inline-block max-w-md mx-auto md:mx-0",
            )}
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
              <CalendarDays className="h-4 w-4 text-primary" />
              {t("planDates")}
            </summary>
            <div className="mt-2 text-xs text-muted-foreground">
              {t("fosterPeriodHelp")}
            </div>
            <div className="mt-4">
              <BorrowerRequestCalendar className="mx-auto" />
            </div>
          </details>
        </>
      )}
      {embedded ? <BorrowerRequestActions /> : null}
    </BorrowerRequestProvider>
  );
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(day: Date): Date {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function GiveawayBorrowerRequestPanel({
  item,
  fullWidth,
  embedded,
}: {
  item: Doc<"items">;
  fullWidth?: boolean;
  embedded?: boolean;
}) {
  const {
    isAuthenticated,
    isAuthLoading,
    isSubmitting,
    requestItem,
    cancelRequest,
    myRequests,
    availability,
  } = useClaimItem(item._id);

  const t = useTranslations("BorrowerRequest");

  const markPickedUp = useTrackedPickup();
  const markReturned = useMutation(api.items.markReturned);

  const [pickupDay, setPickupDay] = React.useState<Date | undefined>(undefined);

  const activeRequests = React.useMemo(
    () => (myRequests ?? []).filter(isActiveRequest),
    [myRequests],
  );

  const hasOpenWorkflow = React.useMemo(() => {
    return activeRequests.length > 0;
  }, [activeRequests]);

  const disabledDayRanges = React.useMemo(() => {
    const startOfLocalDayAt = (at: number): number => {
      const d = new Date(at);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    };

    const toDisabledDayRange = (range: {
      startDate: number;
      endDate: number;
    }): {
      from: Date;
      to: Date;
    } | null => {
      const startDay = startOfLocalDayAt(range.startDate);
      const endDay = startOfLocalDayAt(range.endDate);
      const isAligned =
        range.startDate === startDay && range.endDate === endDay;
      const isAtLeastOneDay = range.endDate - range.startDate >= ONE_DAY_MS;
      if (!isAligned || !isAtLeastOneDay) return null;

      const endInclusive = Math.max(range.startDate, range.endDate - 1);
      return { from: new Date(range.startDate), to: new Date(endInclusive) };
    };

    return (availability ?? [])
      .map(toDisabledDayRange)
      .filter((v): v is { from: Date; to: Date } => v !== null);
  }, [availability]);

  const requestDisabled =
    !pickupDay || isSubmitting || isAuthLoading || !isAuthenticated;

  const calendarContent = (
    <>
      <div className="space-y-2">
        <div className="text-sm font-medium">{t("pickPickupDay")}</div>
        <div className="text-xs text-muted-foreground">{t("giveawayNote")}</div>
      </div>
      <div className="mt-3 flex justify-center">
        <Calendar
          mode="single"
          selected={pickupDay}
          onSelect={setPickupDay}
          disabled={[
            { before: startOfLocalDay(new Date()) },
            ...disabledDayRanges,
          ]}
          numberOfMonths={2}
        />
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        {!hasOpenWorkflow && <AvailabilityToggle id={item._id} />}
        <Button
          size="sm"
          disabled={requestDisabled}
          onClick={async () => {
            if (!pickupDay) return;
            const startDate = startOfLocalDay(pickupDay);
            const endDate = new Date(startDate.getTime() + ONE_DAY_MS);
            await requestItem(startDate, endDate, () =>
              setPickupDay(undefined),
            );
          }}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            t("request")
          )}
        </Button>
      </div>
    </>
  );

  return (
    <>
      {embedded ? (
        calendarContent
      ) : (
        <div
          className={cn(
            "bg-white border rounded-lg p-4 w-full",
            fullWidth ? undefined : "inline-block max-w-md mx-auto md:mx-0",
          )}
        >
          {calendarContent}
        </div>
      )}

      {isAuthenticated && activeRequests.length > 0 ? (
        <div className="mt-6">
          <div className="mb-3">
            <h4 className="font-medium">{t("yourRequests")}</h4>
          </div>
          <div className="space-y-4">
            {activeRequests.map((claim) => (
              <div key={claim._id}>
                <LeaseClaimCard
                  itemId={item._id}
                  claim={claim}
                  viewerRole="borrower"
                  isGiveaway
                  coordinationAddress={item.location?.address}
                  ownerId={item.ownerId}
                  cancelClaim={async ({ claimId }) =>
                    await cancelRequest(claimId)
                  }
                  markPickedUp={markPickedUp}
                  markReturned={markReturned}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
