"use client";

import { ChevronDown } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserLink } from "@/components/user-link";
import { cn } from "@/lib/utils";
import { Doc } from "../convex/_generated/dataModel";

const INITIAL_VISIBLE_EVENTS = 6;
const EVENTS_PAGE_SIZE = 10;
const ALL_USERS_FILTER = "all";

function Actor({ actorId }: { actorId: string }) {
  const t = useTranslations("ItemActivity");
  if (actorId === "system") {
    return <span>{t("system")}</span>;
  }
  return <UserLink userId={actorId} size="sm" showAvatar={false} />;
}

function formatEventTitle(
  event: Doc<"item_activity">,
  isGiveaway: boolean,
  t: (key: string) => string,
): string {
  switch (event.type) {
    case "item_created":
      return t("itemCreated");
    case "loan_started":
      return isGiveaway ? t("giveawayApproved") : t("loanStarted");
    case "item_picked_up":
      return t("itemPickedUp");
    case "item_returned":
      return t("itemReturned");
    default:
      return t("defaultActivity");
  }
}

function EventDetails({
  event,
  isGiveaway,
}: {
  event: Doc<"item_activity">;
  isGiveaway: boolean;
}) {
  const t = useTranslations("ItemActivity");
  const format = useFormatter();

  if (event.type === "loan_started" && event.borrowerId) {
    const startDate = event.startDate ? new Date(event.startDate) : null;
    const endDate = event.endDate ? new Date(event.endDate) : null;

    const dates =
      startDate && endDate
        ? ` (${format.dateTime(startDate, { month: "short", day: "numeric" })} – ${format.dateTime(
            endDate,
            { month: "short", day: "numeric" },
          )})`
        : "";
    return (
      <span>
        {isGiveaway ? t("recipient") : t("borrower")}
        <UserLink userId={event.borrowerId} size="sm" showAvatar={false} />
        {dates}
      </span>
    );
  }

  if (event.note) return <span>{event.note}</span>;
  return null;
}

export function ItemActivityTimeline({
  events,
  className,
  isGiveaway = false,
}: {
  events: Doc<"item_activity">[] | undefined;
  className?: string;
  isGiveaway?: boolean;
}) {
  const t = useTranslations("ItemActivity");
  const format = useFormatter();
  const [isOpen, setIsOpen] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState(ALL_USERS_FILTER);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_EVENTS);
  const safeEvents = events ?? [];

  const userIds = useMemo(() => {
    const ids = new Set<string>();
    for (const event of safeEvents) {
      if (event.actorId && event.actorId !== "system") ids.add(event.actorId);
      if (event.borrowerId) ids.add(event.borrowerId);
    }
    return [...ids];
  }, [safeEvents]);

  const filteredEvents = useMemo(() => {
    if (selectedUserId === ALL_USERS_FILTER) return safeEvents;
    return safeEvents.filter(
      (event) =>
        event.actorId === selectedUserId || event.borrowerId === selectedUserId,
    );
  }, [safeEvents, selectedUserId]);

  const visibleEvents = filteredEvents.slice(0, visibleCount);
  const canShowMore = visibleCount < filteredEvents.length;

  if (events === undefined) {
    return (
      <div className={cn("space-y-3", className)}>
        <ActivityHeader isOpen={isOpen} onToggle={() => setIsOpen((v) => !v)} />
        <div className="text-sm text-muted-foreground">{t("loading")}</div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={cn("space-y-3", className)}>
        <ActivityHeader isOpen={isOpen} onToggle={() => setIsOpen((v) => !v)} />
        {isOpen ? (
          <div className="text-sm text-muted-foreground">{t("noActivity")}</div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <ActivityHeader
        isOpen={isOpen}
        onToggle={() => setIsOpen((v) => !v)}
        count={filteredEvents.length}
      />
      {isOpen ? (
        <>
          {userIds.length > 1 ? (
            <Select
              value={selectedUserId}
              onValueChange={(value) => {
                setSelectedUserId(value);
                setVisibleCount(INITIAL_VISIBLE_EVENTS);
              }}
            >
              <SelectTrigger className="h-8 w-full sm:w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_USERS_FILTER}>
                  {t("allUsers")}
                </SelectItem>
                {userIds.map((userId) => (
                  <SelectItem key={userId} value={userId}>
                    <UserLink userId={userId} size="sm" showAvatar={false} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {filteredEvents.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              {t("noFilteredActivity")}
            </div>
          ) : null}
          {visibleEvents.map((event) => {
            const title = formatEventTitle(event, isGiveaway, t);
            return (
              <div key={event._id} className="flex gap-3">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-muted-foreground" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-medium">{title}</span>
                    <span className="text-xs text-muted-foreground">
                      {format.dateTime(new Date(event.createdAt), {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "numeric",
                      })}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      {t("by")} <Actor actorId={event.actorId} />
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <EventDetails event={event} isGiveaway={isGiveaway} />
                  </div>
                </div>
              </div>
            );
          })}
          {canShowMore ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setVisibleCount((count) => count + EVENTS_PAGE_SIZE)
              }
            >
              {t("showMore")}
            </Button>
          ) : filteredEvents.length > INITIAL_VISIBLE_EVENTS ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setVisibleCount(INITIAL_VISIBLE_EVENTS)}
            >
              {t("showLess")}
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function ActivityHeader({
  isOpen,
  onToggle,
  count,
}: {
  isOpen: boolean;
  onToggle: () => void;
  count?: number;
}) {
  const t = useTranslations("ItemActivity");

  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-3 text-left"
      aria-expanded={isOpen}
      onClick={onToggle}
    >
      <span className="text-base font-semibold">
        {count === undefined ? t("title") : t("titleWithCount", { count })}
      </span>
      <ChevronDown
        className={cn(
          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
          isOpen && "rotate-180",
        )}
      />
    </button>
  );
}
