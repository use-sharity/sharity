"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { ArrowLeft, Send } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CoordinationCard } from "@/components/chat/coordination-card";
import { MessageBubble } from "@/components/chat/message-bubble";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";

function AvatarFallback({ name, src }: { name: string; src?: string | null }) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 rounded-full object-cover"
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
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
      {initials || "?"}
    </div>
  );
}

interface ThreadPageProps {
  params: Promise<{ id: string }>;
}

export default function ChatThreadPage({ params }: ThreadPageProps) {
  const { id } = use(params);
  const conversationId = id as Id<"conversations">;

  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isNearBottomRef = useRef(true);

  const conversation = useQuery(
    api.messaging.getConversation,
    isSignedIn ? { conversationId } : "skip",
  );
  const { results: messages, status } = usePaginatedQuery(
    api.messaging.listMessages,
    isSignedIn ? { conversationId } : "skip",
    { initialNumItems: 30 },
  );
  const sendMessage = useMutation(api.messaging.sendMessage);
  const markRead = useMutation(api.messaging.markRead);

  // Mark read on mount and when new messages arrive
  useEffect(() => {
    if (!conversation) return;
    void markRead({ conversationId });
  }, [conversation, markRead, conversationId]);

  // Scroll to bottom when new messages arrive (only if user is near bottom)
  const scrollToBottom = useCallback((instant = false) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: instant ? "instant" : "smooth",
    });
  }, []);

  const prevMessageCountRef = useRef(0);
  useEffect(() => {
    if (!messages) return;
    const isNewMessage = messages.length > prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;
    if (isNewMessage && isNearBottomRef.current) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  // Initial scroll
  useEffect(() => {
    if (status === "CanLoadMore" || status === "Exhausted") {
      scrollToBottom(true);
    }
  }, [status, scrollToBottom]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distFromBottom < 80;
  }, []);

  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const lineHeight = 20;
    const maxHeight = lineHeight * 4 + 16; // 4 lines + padding
    ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [resizeTextarea]);

  const handleBodyChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setBody(event.target.value);
      requestAnimationFrame(resizeTextarea);
    },
    [resizeTextarea],
  );

  const handleSend = useCallback(async () => {
    const trimmed = body.trim();
    if (!trimmed || isSending) return;
    setIsSending(true);
    try {
      await sendMessage({ conversationId, body: trimmed });
      setBody("");
      isNearBottomRef.current = true;
      scrollToBottom();
      requestAnimationFrame(resizeTextarea);
    } finally {
      setIsSending(false);
    }
  }, [
    body,
    isSending,
    sendMessage,
    conversationId,
    scrollToBottom,
    resizeTextarea,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  // Messages are returned newest-first from Convex; reverse for display
  const orderedMessages = useMemo(
    () => (messages ? [...messages].reverse() : []),
    [messages],
  );

  const currentUserId = user?.id ?? "";

  const headerData = useMemo(() => {
    if (!conversation) return null;
    return {
      otherUser: conversation.otherUser,
      item: conversation.item,
    };
  }, [conversation]);

  return (
    <main
      className="grid w-full overflow-hidden bg-gray-50/50"
      style={{
        height: "100vh",
        gridTemplateRows: "auto auto minmax(0, 1fr) auto",
      }}
    >
      {/* Header */}
      <div className="shrink-0 border-b bg-background safe-area-pt">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2.5 md:px-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {headerData ? (
            <>
              <AvatarFallback
                name={headerData.otherUser?.name ?? "Unknown"}
                src={headerData.otherUser?.avatar}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {headerData.otherUser?.name ?? "Unknown"}
                </p>
                {headerData.item && (
                  <button
                    type="button"
                    className="truncate text-left text-xs text-muted-foreground hover:underline"
                    onClick={() => router.push(`/item/${headerData.item?._id}`)}
                  >
                    {headerData.item.name}
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            </>
          )}
        </div>
      </div>

      <div className="shrink-0">
        <CoordinationCard conversationId={conversationId} />
      </div>

      {/* Messages */}
      <div
        className="min-h-0 overflow-y-auto overscroll-contain"
        onScroll={handleScroll}
        aria-live="polite"
      >
        <div className="mx-auto max-w-2xl px-4 py-3 md:px-8">
          {status === "LoadingFirstPage" && (
            <div className="flex justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          {orderedMessages.map((msg) => (
            <div key={msg._id} className="mb-2">
              <MessageBubble
                body={msg.body}
                type={msg.type}
                systemEvent={msg.systemEvent}
                systemWindowStartAt={msg.systemWindowStartAt}
                systemWindowEndAt={msg.systemWindowEndAt}
                systemPlace={msg.systemPlace}
                systemNote={msg.systemNote}
                senderId={msg.senderId}
                currentUserId={currentUserId}
                createdAt={msg.createdAt}
              />
            </div>
          ))}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 pb-[calc(env(safe-area-inset-bottom)+0.875rem)]">
        <div className="mx-auto flex max-w-2xl items-end gap-2 px-4 md:px-8">
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={handleBodyChange}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            rows={1}
            className={cn(
              "max-h-[100px] min-h-[40px] flex-1 resize-none overflow-hidden rounded-2xl border bg-background px-3.5 py-2.5 text-sm shadow-sm",
              "focus-visible:ring-2 focus-visible:ring-primary/30",
            )}
          />
          <Button
            type="button"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full"
            disabled={!body.trim() || isSending}
            onClick={handleSend}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </main>
  );
}
