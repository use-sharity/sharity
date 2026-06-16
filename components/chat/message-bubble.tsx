"use client";

import { format } from "date-fns";
import {
  CheckCircle2,
  CircleDashed,
  PackageCheck,
  RefreshCw,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  body: string;
  type: "text" | "system";
  systemEvent?: string;
  systemWindowStartAt?: number;
  systemWindowEndAt?: number;
  systemPlace?: string;
  systemNote?: string;
  senderId: string;
  currentUserId: string;
  createdAt: number;
}

export function MessageBubble({
  body,
  type,
  systemEvent,
  systemWindowStartAt,
  systemWindowEndAt,
  systemPlace,
  systemNote,
  senderId,
  currentUserId,
  createdAt,
}: MessageBubbleProps) {
  if (type === "system") {
    const isMeetupEvent =
      systemEvent === "pickup_proposed" ||
      systemEvent === "pickup_approved" ||
      systemEvent === "return_proposed" ||
      systemEvent === "return_approved" ||
      systemEvent === "picked_up" ||
      systemEvent === "returned";
    const isApproved =
      systemEvent === "pickup_approved" ||
      systemEvent === "return_approved" ||
      systemEvent === "picked_up" ||
      systemEvent === "returned";
    const Icon =
      systemEvent === "return_proposed" || systemEvent === "return_approved"
        ? RefreshCw
        : systemEvent === "picked_up" || systemEvent === "returned"
          ? PackageCheck
          : isApproved
            ? CheckCircle2
            : CircleDashed;
    const meetupLabel = (() => {
      switch (systemEvent) {
        case "pickup_proposed":
          return "Pickup plan proposed";
        case "pickup_approved":
          return "Pickup plan approved";
        case "return_proposed":
          return "Return request sent";
        case "return_approved":
          return "Return details approved";
        default:
          return body;
      }
    })();
    const localWindow =
      systemWindowStartAt !== undefined && systemWindowEndAt !== undefined
        ? `${format(new Date(systemWindowStartAt), "MMM d, HH:mm")} - ${format(new Date(systemWindowEndAt), "HH:mm")}`
        : null;
    const hasStructuredMeetup =
      Boolean(localWindow || systemPlace || systemNote) &&
      (systemEvent === "pickup_proposed" ||
        systemEvent === "pickup_approved" ||
        systemEvent === "return_proposed" ||
        systemEvent === "return_approved");

    if (isMeetupEvent) {
      return (
        <div className="flex justify-center py-1 px-2 sm:px-0">
          <div
            className={cn(
              "w-full max-w-[min(42rem,94vw)] rounded-lg border px-3 py-2 text-xs shadow-xs sm:max-w-[86%]",
              isApproved
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-200 bg-amber-50 text-amber-950",
            )}
          >
            <div className="flex items-start gap-2">
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0 flex-1">
                {hasStructuredMeetup ? (
                  <div className="space-y-1 leading-relaxed">
                    <p className="font-medium">{meetupLabel}</p>
                    {localWindow ? (
                      <p className="break-words">{localWindow}</p>
                    ) : null}
                    {systemPlace ? (
                      <p className="break-words">at {systemPlace}</p>
                    ) : null}
                    {systemNote ? (
                      <p className="break-words opacity-80">{systemNote}</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words leading-relaxed">
                    {body}
                  </p>
                )}
                <p className="mt-1 text-[10px] opacity-70">
                  {format(new Date(createdAt), "HH:mm")}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex justify-center py-1">
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          {body}
        </span>
      </div>
    );
  }

  const isMine = senderId === currentUserId;

  return (
    <div className={cn("flex", isMine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3.5 py-2",
          isMine
            ? "rounded-tr-sm bg-primary text-primary-foreground"
            : "rounded-tl-sm bg-muted text-foreground",
        )}
      >
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {body}
        </p>
        <p
          className={cn(
            "mt-0.5 text-right text-[10px] leading-none",
            isMine ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          {format(new Date(createdAt), "HH:mm")}
        </p>
      </div>
    </div>
  );
}
