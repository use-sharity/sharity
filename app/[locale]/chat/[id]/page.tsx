"use client";

import { usePaginatedQuery, useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { ArrowLeft, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { api } from "@/convex/_generated/api";

import { MessageBubble } from "@/components/chat/message-bubble";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function AvatarFallback({ name, src }: { name: string; src?: string | null }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="h-8 w-8 shrink-0 rounded-full object-cover"
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
  // Type cast deferred until api.chat types are generated after backend merge
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conversationId = id as any;

  const router = useRouter();
  const { user } = useUser();

  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isNearBottomRef = useRef(true);

  const conversation = useQuery(api.messaging.getConversation, {
    conversationId,
  });
  const { results: messages, status } = usePaginatedQuery(
    api.messaging.listMessages,
    { conversationId },
    { initialNumItems: 30 },
  );
  const sendMessage = useMutation(api.messaging.sendMessage);
  const markRead = useMutation(api.messaging.markRead);

  // Mark read on mount and when new messages arrive
  useEffect(() => {
    if (!conversation) return;
    void markRead({ conversationId });
  }, [conversation, markRead, conversationId, messages?.length]);

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

  // Auto-grow textarea, max 4 lines
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const lineHeight = 20;
    const maxHeight = lineHeight * 4 + 16; // 4 lines + padding
    ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`;
  }, [body]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [body, isSending],
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
    } finally {
      setIsSending(false);
    }
  }, [body, isSending, sendMessage, conversationId, scrollToBottom]);

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
      className="flex h-dvh flex-col bg-background"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b px-4 py-2.5 safe-area-pt">
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

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain px-4 py-3"
        onScroll={handleScroll}
        aria-live="polite"
      >
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
              senderId={msg.senderId}
              currentUserId={currentUserId}
              createdAt={msg.createdAt}
            />
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t bg-background px-3 py-2">
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            rows={1}
            className={cn(
              "max-h-[100px] min-h-[40px] flex-1 resize-none rounded-2xl border px-3.5 py-2.5 text-sm",
              "focus-visible:ring-2 focus-visible:ring-primary/30",
            )}
            style={{ fieldSizing: "content" } as React.CSSProperties}
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
