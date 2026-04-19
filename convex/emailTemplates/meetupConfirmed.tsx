import { Section, Text } from "@react-email/components";
import * as React from "react";
import { Callout, EmailButton, SharityEmail, appUrl, COLORS } from "./_shared";
import { t, formatWindowLocalized, contactLines } from "./i18n";
import type { Locale } from "./i18n";
import type { ContactInfo } from "./_shared";

export interface MeetupConfirmedData {
  recipientName: string;
  counterpartyName: string;
  counterpartyContacts: ContactInfo;
  itemName: string;
  windowStartAt: number;
  windowEndAt: number;
  itemId: string;
  meetupType: "pickup" | "return";
  locale: Locale;
}

export function MeetupConfirmedEmail(data: MeetupConfirmedData) {
  const windowStr = formatWindowLocalized(
    data.windowStartAt,
    data.windowEndAt,
    data.locale,
  );
  const itemUrl = appUrl(`/item/${data.itemId}`);
  const contacts = contactLines(data.counterpartyContacts, data.locale);
  const typeKey = data.meetupType === "pickup" ? "pickup" : "return";

  return (
    <SharityEmail
      preview={t(data.locale, "meetupConfirmed.preview", {
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
        {t(data.locale, "meetupConfirmed.heading")}
      </Text>
      <Text style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 8px" }}>
        {t(data.locale, "meetupConfirmed.greeting", {
          recipientName: data.recipientName,
        })}
      </Text>
      <Text
        style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 16px" }}
      >
        {t(data.locale, `meetupConfirmed.body.${typeKey}`, {
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
      <Text style={{ color: COLORS.body, fontSize: "14px", margin: "0 0 4px" }}>
        {t(data.locale, "meetupConfirmed.whoToMeet", {
          name: data.counterpartyName,
        })}
      </Text>
      <Text
        style={{ color: COLORS.body, fontSize: "14px", margin: "0 0 16px" }}
      >
        {t(data.locale, "meetupConfirmed.contactInfo")}
        <br />
        {contacts}
      </Text>
      <EmailButton href={itemUrl}>
        {t(data.locale, "meetupConfirmed.cta")}
      </EmailButton>
      <Callout>{t(data.locale, `meetupConfirmed.callout.${typeKey}`)}</Callout>
    </SharityEmail>
  );
}
