"use client";

import { MessageCircle, Phone, Facebook, Check, Lock } from "lucide-react";
import { useTranslations } from "next-intl";

interface AvailableContacts {
  telegram: boolean;
  whatsapp: boolean;
  facebook: boolean;
  phone: boolean;
}

interface FullContacts {
  telegram?: string;
  whatsapp?: string;
  facebook?: string;
  phone?: string;
}

interface ContactInfoProps {
  availableContacts?: AvailableContacts;
  contacts?: FullContacts | null;
  showValues?: boolean;
  compact?: boolean;
}

export function ContactInfo({
  availableContacts,
  contacts,
  showValues = false,
  compact = false,
}: ContactInfoProps) {
  const t = useTranslations("ContactInfo");

  // If we have full contacts and should show values
  if (showValues && contacts) {
    const hasAnyContact =
      contacts.telegram ||
      contacts.whatsapp ||
      contacts.facebook ||
      contacts.phone;

    if (!hasAnyContact) {
      return <div className="text-sm text-muted-foreground">{t("noInfo")}</div>;
    }

    return (
      <div className={compact ? "flex flex-wrap gap-2" : "flex flex-col gap-2"}>
        {contacts.telegram && (
          <ContactRow
            icon={<MessageCircle className="h-4 w-4 text-blue-500" />}
            label={t("labels.telegram")}
            value={contacts.telegram}
            link={`https://t.me/${contacts.telegram.replace("@", "")}`}
            compact={compact}
          />
        )}
        {contacts.whatsapp && (
          <ContactRow
            icon={<MessageCircle className="h-4 w-4 text-green-500" />}
            label={t("labels.whatsapp")}
            value={contacts.whatsapp}
            link={`https://wa.me/${contacts.whatsapp.replace(/[^0-9]/g, "")}`}
            compact={compact}
          />
        )}
        {contacts.facebook && (
          <ContactRow
            icon={<Facebook className="h-4 w-4 text-blue-600" />}
            label={t("labels.facebook")}
            value={contacts.facebook}
            link={
              contacts.facebook.startsWith("http")
                ? contacts.facebook
                : `https://facebook.com/${contacts.facebook}`
            }
            compact={compact}
          />
        )}
        {contacts.phone && (
          <ContactRow
            icon={<Phone className="h-4 w-4 text-gray-600" />}
            label={t("labels.phone")}
            value={contacts.phone}
            link={`tel:${contacts.phone}`}
            compact={compact}
          />
        )}
      </div>
    );
  }

  // Show available contact methods (without values)
  if (availableContacts) {
    const available = Object.entries(availableContacts).filter(([, v]) => v);

    if (available.length === 0) {
      return (
        <div className="text-sm text-muted-foreground">{t("noMethods")}</div>
      );
    }

    return (
      <div className="flex flex-col gap-2">
        {!compact ? (
          <p className="text-sm text-muted-foreground">
            {t("availableMethods")}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {availableContacts.telegram && (
            <ContactBadge
              icon={<MessageCircle className="h-3 w-3 text-blue-500" />}
              label={t("labels.telegram")}
            />
          )}
          {availableContacts.whatsapp && (
            <ContactBadge
              icon={<MessageCircle className="h-3 w-3 text-green-500" />}
              label={t("labels.whatsapp")}
            />
          )}
          {availableContacts.facebook && (
            <ContactBadge
              icon={<Facebook className="h-3 w-3 text-blue-600" />}
              label={t("labels.facebook")}
            />
          )}
          {availableContacts.phone && (
            <ContactBadge
              icon={<Phone className="h-3 w-3 text-gray-600" />}
              label={t("labels.phone")}
            />
          )}
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
          <Lock className="h-3 w-3" />
          {t("sharedAfter")}
        </p>
      </div>
    );
  }

  return null;
}

function ContactRow({
  icon,
  label,
  value,
  link,
  compact,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  link?: string;
  compact?: boolean;
}) {
  const content = (
    <div className="flex min-w-0 items-center gap-2">
      {icon}
      <span className={compact ? "sr-only" : "text-sm text-muted-foreground"}>
        {label}:
      </span>
      <span className="truncate text-sm font-medium">{value}</span>
    </div>
  );

  if (link) {
    return (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className={
          compact
            ? "min-w-0 rounded-full border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-muted"
            : "hover:bg-gray-50 rounded p-1 -m-1 transition-colors"
        }
      >
        {content}
      </a>
    );
  }

  return content;
}

function ContactBadge({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded-full text-xs">
      {icon}
      <span>{label}</span>
      <Check className="h-3 w-3 text-green-500" />
    </div>
  );
}
