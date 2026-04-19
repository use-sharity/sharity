import { Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailButton, SharityEmail, appUrl, COLORS } from "./_shared";
import { t, formatDateLocalized, contactLines } from "./i18n";
import type { Locale } from "./i18n";
import type { ContactInfo } from "./_shared";

export interface OverdueAlertData {
  recipientName: string;
  itemName: string;
  originalEndDate: number;
  counterpartyName: string;
  counterpartyContacts: ContactInfo;
  itemId: string;
  role: "owner" | "borrower";
  locale: Locale;
}

export function OverdueAlertEmail(data: OverdueAlertData) {
  const dueDateStr = formatDateLocalized(data.originalEndDate, data.locale);
  const itemUrl = appUrl(`/item/${data.itemId}`);
  const contacts = contactLines(data.counterpartyContacts, data.locale);

  const headline = t(data.locale, `overdueAlert.headline.${data.role}`, {
    itemName: data.itemName,
  });
  const body = t(data.locale, `overdueAlert.body.${data.role}`, {
    itemName: data.itemName,
    dueDate: dueDateStr,
  });

  return (
    <SharityEmail
      preview={t(data.locale, "overdueAlert.preview", {
        itemName: data.itemName,
      })}
      locale={data.locale}
    >
      <Section
        style={{
          backgroundColor: COLORS.danger,
          borderRadius: "6px",
          padding: "8px 16px",
          margin: "0 0 16px",
        }}
      >
        <Text
          style={{
            color: COLORS.dangerText,
            fontSize: "13px",
            fontWeight: "700",
            margin: "0",
            textTransform: "uppercase" as const,
            letterSpacing: "0.05em",
          }}
        >
          {t(data.locale, "overdueAlert.badge")}
        </Text>
      </Section>
      <Text
        style={{
          fontSize: "20px",
          fontWeight: "700",
          color: COLORS.heading,
          margin: "0 0 12px",
        }}
      >
        {headline}
      </Text>
      <Text style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 8px" }}>
        {t(data.locale, "overdueAlert.greeting", {
          recipientName: data.recipientName,
        })}
      </Text>
      <Text
        style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 16px" }}
      >
        {body}
      </Text>
      <Text style={{ color: COLORS.body, fontSize: "14px", margin: "0 0 4px" }}>
        {t(data.locale, "overdueAlert.contactLabel", {
          counterpartyName: data.counterpartyName,
        })}
      </Text>
      <Text
        style={{
          color: COLORS.body,
          fontSize: "14px",
          margin: "0 0 16px",
          whiteSpace: "pre-line" as const,
        }}
      >
        {contacts}
      </Text>
      <EmailButton href={itemUrl}>
        {t(data.locale, "overdueAlert.cta")}
      </EmailButton>
      <Section
        style={{
          backgroundColor: COLORS.card,
          borderRadius: "6px",
          padding: "12px 16px",
          margin: "16px 0 0",
        }}
      >
        <Text style={{ color: COLORS.body, fontSize: "14px", margin: "0" }}>
          {t(data.locale, "overdueAlert.support")}
        </Text>
      </Section>
    </SharityEmail>
  );
}
