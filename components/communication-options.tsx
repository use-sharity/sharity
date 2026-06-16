"use client";

import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";

import { ContactInfo } from "@/components/contact-info";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";

type CommunicationOptionsProps = {
  otherUserId: string;
  onChat: () => void | Promise<void>;
  disabled?: boolean;
  canShowContactValues: boolean;
  showChatButton?: boolean;
  hasUnread?: boolean;
  lastMessagePreview?: string | null;
};

export function CommunicationOptions({
  otherUserId,
  onChat,
  disabled,
  canShowContactValues,
  showChatButton = true,
  hasUnread,
  lastMessagePreview,
}: CommunicationOptionsProps) {
  const t = useTranslations("CommunicationOptions");
  const publicProfile = useQuery(
    api.users.getProfile,
    otherUserId ? { userId: otherUserId } : "skip",
  );
  const profileWithContacts = useQuery(
    api.users.getProfileWithContacts,
    canShowContactValues && otherUserId ? { userId: otherUserId } : "skip",
  );

  return (
    <section className="rounded-md border bg-background p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-foreground">
            {t("title")}
          </div>
          <div className="text-xs text-muted-foreground">
            {canShowContactValues ? t("approvedHint") : t("lockedHint")}
          </div>
        </div>
        {hasUnread ? (
          <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] leading-none text-primary-foreground">
            {t("unread")}
          </span>
        ) : null}
      </div>

      <div className="mt-2 grid gap-2">
        {showChatButton ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-auto min-h-9 w-full justify-start gap-2 px-2 py-1.5 text-left"
            disabled={disabled}
            onClick={onChat}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <MessageCircle className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold">
                {t("sharityChat")}
              </span>
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {lastMessagePreview || t("chatFallback")}
              </span>
            </span>
          </Button>
        ) : null}

        <ContactInfo
          availableContacts={publicProfile?.availableContacts}
          contacts={profileWithContacts?.contacts}
          showValues={canShowContactValues && profileWithContacts !== null}
          compact
        />
      </div>
    </section>
  );
}
