"use client";

import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";

export function UnreadBadge() {
  const summary = useQuery(api.messaging.getUnreadSummary);

  if (!summary || summary.totalUnread === 0) return null;

  return (
    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background">
      {summary.totalUnread > 99 ? "99+" : summary.totalUnread}
    </span>
  );
}
