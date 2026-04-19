"use client";

import { useFormatter, useTranslations } from "next-intl";

import { UserLink } from "@/components/user-link";
import { cn } from "@/lib/utils";
import { Doc } from "../convex/_generated/dataModel";

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

  if (events === undefined) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        {t("loading")}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        {t("noActivity")}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {events.map((event) => {
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
    </div>
  );
}
