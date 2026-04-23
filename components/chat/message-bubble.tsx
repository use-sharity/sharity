"use client";

import { format } from "date-fns";

import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  body: string;
  type: "text" | "system";
  systemEvent?: string;
  senderId: string;
  currentUserId: string;
  createdAt: number;
}

export function MessageBubble({
  body,
  type,
  senderId,
  currentUserId,
  createdAt,
}: MessageBubbleProps) {
  if (type === "system") {
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
