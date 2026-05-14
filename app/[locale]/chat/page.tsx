"use client";

import { useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, MessageCircle } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

interface ConversationItem {
  _id: string;
  itemId: string;
  itemName: string;
  itemImage?: string | null;
  otherUser: { clerkId: string; name: string; avatar?: string | null };
  lastMessagePreview?: string | null;
  lastMessageAt?: number | null;
  lastMessageSenderId?: string | null;
  hasUnread: boolean;
}

function ConversationSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-muted" />
      <div className="flex-1 space-y-1.5">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-3 w-48 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-3 w-10 animate-pulse rounded bg-muted" />
    </div>
  );
}

function AvatarFallback({ name, src }: { name: string; src?: string | null }) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={40}
        height={40}
        className="h-10 w-10 shrink-0 rounded-full object-cover"
        unoptimized
      />
    );
  }
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
      {initials || "?"}
    </div>
  );
}

export default function ChatListPage() {
  const router = useRouter();
  const conversations = useQuery(api.messaging.listMyConversations) as
    | ConversationItem[]
    | undefined;

  return (
    <main className="flex h-dvh w-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3 safe-area-pt">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">Messages</h1>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {conversations === undefined ? (
          <>
            <ConversationSkeleton />
            <ConversationSkeleton />
            <ConversationSkeleton />
          </>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 px-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <MessageCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No conversations yet. Message someone about an item to start
              chatting.
            </p>
          </div>
        ) : (
          <ul>
            {conversations.map((conv) => (
              <li key={conv._id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 active:bg-muted",
                    conv.hasUnread && "bg-primary/5",
                  )}
                  onClick={() => router.push(`/chat/${conv._id}`)}
                >
                  <AvatarFallback
                    name={conv.otherUser.name}
                    src={conv.otherUser.avatar}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "truncate text-sm",
                          conv.hasUnread ? "font-semibold" : "font-medium",
                        )}
                      >
                        {conv.otherUser.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {conv.lastMessageAt
                          ? formatDistanceToNow(new Date(conv.lastMessageAt), {
                              addSuffix: false,
                            })
                          : ""}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {conv.itemName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {conv.lastMessagePreview}
                    </p>
                  </div>

                  {conv.hasUnread && (
                    <Badge className="h-2 w-2 shrink-0 rounded-full p-0" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
