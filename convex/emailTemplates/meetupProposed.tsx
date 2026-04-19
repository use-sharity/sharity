import { Section, Text } from "@react-email/components";
import * as React from "react";
import { Callout, EmailButton, SharityEmail, appUrl, COLORS } from "./_shared";
import { t, formatWindowLocalized } from "./i18n";
import type { Locale } from "./i18n";

export interface MeetupProposedData {
  recipientName: string;
  proposerName: string;
  itemName: string;
  windowStartAt: number;
  windowEndAt: number;
  itemId: string;
  meetupType: "pickup" | "return";
  locale: Locale;
}

export function MeetupProposedEmail(data: MeetupProposedData) {
  const windowStr = formatWindowLocalized(
    data.windowStartAt,
    data.windowEndAt,
    data.locale,
  );
  const itemUrl = appUrl(`/item/${data.itemId}`);
  const typeKey = data.meetupType === "pickup" ? "pickup" : "return";

  return (
    <SharityEmail
      preview={t(data.locale, `meetupProposed.preview.${typeKey}`, {
        itemName: data.itemName,
      })}
      locale={data.locale}
    >
      <Text
        style={{
          fontSize: "22px",
          fontWeight: "700",
          color: COLORS.heading,
          margin: "0 0 12px",
        }}
      >
        {t(data.locale, `meetupProposed.heading.${typeKey}`)}
      </Text>
      <Text style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 8px" }}>
        {t(data.locale, "meetupProposed.greeting", {
          recipientName: data.recipientName,
        })}
      </Text>
      <Text
        style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 16px" }}
      >
        {t(data.locale, `meetupProposed.body.${typeKey}`, {
          proposerName: data.proposerName,
          itemName: data.itemName,
        })}
      </Text>
      <Section
        style={{
          backgroundColor: COLORS.card,
          borderRadius: "6px",
          padding: "12px 16px",
          margin: "0 0 16px",
          textAlign: "center" as const,
        }}
      >
        <Text
          style={{
            fontSize: "16px",
            fontWeight: "700",
            color: COLORS.heading,
            margin: "0",
          }}
        >
          {windowStr}
        </Text>
      </Section>
      <Callout>{t(data.locale, "meetupProposed.callout")}</Callout>
      <EmailButton href={itemUrl}>
        {t(data.locale, "meetupProposed.cta")}
      </EmailButton>
      <Text
        style={{ color: COLORS.muted, fontSize: "13px", margin: "12px 0 0" }}
      >
        {t(data.locale, "meetupProposed.footer")}
      </Text>
    </SharityEmail>
  );
}
