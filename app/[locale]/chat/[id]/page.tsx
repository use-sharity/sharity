"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { ArrowLeft, MessageCircle, Send } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CoordinationCard } from "@/components/chat/coordination-card";
import { MessageBubble } from "@/components/chat/message-bubble";
import { CommunicationOptions } from "@/components/communication-options";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/routing";
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
        className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-border/60"
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
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-border/60">
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
  const t = useTranslations("ChatThread");
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const composer = composerRef.current;
    const page = pageRef.current;
    const textarea = textareaRef.current;
    if (!composer || !page || !textarea) return;

    const syncComposer = () => {
      const viewport = window.visualViewport;
      const isComposerFocused = document.activeElement === textarea;
      const layoutHeight = document.documentElement.clientHeight;
      const rawShift = viewport
        ? viewport.offsetTop + viewport.height - layoutHeight
        : 0;
      const maxKeyboardShift = -(layoutHeight * 0.65);
      const shiftY = isComposerFocused
        ? Math.min(0, Math.max(maxKeyboardShift, rawShift))
        : 0;
      const composerHeight = composer.getBoundingClientRect().height;

      composer.style.setProperty("--chat-composer-shift-y", `${shiftY}px`);
      page.style.setProperty(
        "--chat-composer-clearance",
        `${composerHeight + Math.abs(shiftY)}px`,
      );
      page.style.setProperty("--chat-composer-height", `${composerHeight}px`);

      if (isComposerFocused && isNearBottomRef.current) {
        requestAnimationFrame(() => scrollToBottom(true));
      }
    };

    syncComposer();
    const resizeObserver = new ResizeObserver(syncComposer);
    resizeObserver.observe(composer);
    textarea.addEventListener("focus", syncComposer);
    textarea.addEventListener("blur", syncComposer);
    window.visualViewport?.addEventListener("resize", syncComposer);
    window.visualViewport?.addEventListener("scroll", syncComposer);
    window.visualViewport?.addEventListener("scrollend", syncComposer);
    window.addEventListener("resize", syncComposer);

    return () => {
      resizeObserver.disconnect();
      textarea.removeEventListener("focus", syncComposer);
      textarea.removeEventListener("blur", syncComposer);
      window.visualViewport?.removeEventListener("resize", syncComposer);
      window.visualViewport?.removeEventListener("scroll", syncComposer);
      window.visualViewport?.removeEventListener("scrollend", syncComposer);
      window.removeEventListener("resize", syncComposer);
      composer.style.removeProperty("--chat-composer-shift-y");
      page.style.removeProperty("--chat-composer-clearance");
      page.style.removeProperty("--chat-composer-height");
    };
  }, [scrollToBottom]);

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

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }, [router]);

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
      ref={pageRef}
      className="grid h-dvh max-h-dvh w-full overflow-hidden bg-muted/20"
      style={{
        gridTemplateRows:
          "auto auto auto minmax(0, 1fr) var(--chat-composer-clearance,90px)",
      }}
    >
      {/* Header */}
      <div className="shrink-0 border-b bg-background/95 safe-area-pt shadow-xs backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 py-2.5 md:px-8">
          <button
            type="button"
            onClick={handleBack}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t("goBack")}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {headerData ? (
            <>
              <AvatarFallback
                name={headerData.otherUser?.name ?? "Unknown"}
                src={headerData.otherUser?.avatar}
              />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[15px] font-semibold text-foreground">
                  {headerData.otherUser?.name ?? "Unknown"}
                </p>
                {headerData.item && (
                  <button
                    type="button"
                    className="mt-1 inline-flex max-w-full items-center rounded-full bg-muted/70 px-2.5 py-1 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                    onClick={() => router.push(`/item/${headerData.item?._id}`)}
                  >
                    <span className="truncate">{headerData.item.name}</span>
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-5 w-44 max-w-full animate-pulse rounded-full bg-muted" />
              </div>
            </>
          )}

          <Link
            href="/chat"
            className="ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-muted"
            aria-label={t("allChats")}
          >
            <MessageCircle className="h-4 w-4" />
            <span>{t("allChats")}</span>
          </Link>
        </div>
      </div>

      {conversation?.otherUser?.clerkId ? (
        <div className="shrink-0 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto max-w-2xl px-3 py-2 md:px-8">
            <CommunicationOptions
              otherUserId={conversation.otherUser.clerkId}
              onChat={() => undefined}
              canShowContactValues={Boolean(conversation.conversation.claimId)}
              showChatButton={false}
            />
          </div>
        </div>
      ) : (
        <div />
      )}

      <div className="shrink-0">
        <CoordinationCard conversationId={conversationId} />
      </div>

      {/* Messages */}
      <div
        className="min-h-0 overflow-y-auto overscroll-contain"
        onScroll={handleScroll}
        aria-live="polite"
      >
        <div className="mx-auto max-w-2xl px-3 py-3 md:px-8">
          {status === "LoadingFirstPage" && (
            <div className="space-y-3 py-2">
              <div className="h-9 w-2/3 animate-pulse rounded-2xl rounded-tl-sm bg-muted" />
              <div className="ml-auto h-9 w-1/2 animate-pulse rounded-2xl rounded-tr-sm bg-primary/15" />
              <div className="h-16 w-4/5 animate-pulse rounded-2xl rounded-tl-sm bg-muted" />
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

      <div aria-hidden="true" />

      {/* Composer */}
      <div
        ref={composerRef}
        className="fixed inset-x-0 bottom-0 z-30 shrink-0 translate-y-[var(--chat-composer-shift-y,0px)] border-t bg-background/95 px-3 py-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-[0_-8px_24px_rgba(0,0,0,0.04)] backdrop-blur will-change-transform"
      >
        <div
          className="mx-auto flex w-full max-w-[calc(100vw-1.5rem)] min-w-0 items-end gap-2 overflow-hidden rounded-full border bg-card px-2 py-2 shadow-sm md:max-w-2xl"
          style={{ borderRadius: "9999px" }}
        >
          <Textarea
            ref={textareaRef}
            value={body}
            onChange={handleBodyChange}
            onKeyDown={handleKeyDown}
            placeholder={t("messagePlaceholder")}
            rows={1}
            className={cn(
              "max-h-[104px] min-h-10 min-w-0 flex-1 resize-none overflow-hidden rounded-full border-0 bg-transparent px-2 py-2.5 text-base leading-5 shadow-none outline-none",
              "focus-visible:ring-0 focus-visible:ring-offset-0 md:text-sm",
            )}
          />
          <Button
            type="button"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full"
            disabled={!body.trim() || isSending}
            onClick={handleSend}
            aria-label={t("sendMessage")}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </main>
  );
}
