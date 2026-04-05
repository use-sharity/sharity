import { Section, Text } from "@react-email/components";
import * as React from "react";
import {
  Callout,
  EmailButton,
  SharityEmail,
  appUrl,
  contactLines,
  formatWindow,
  COLORS,
} from "./_shared";
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
}

export function MeetupConfirmedEmail(data: MeetupConfirmedData) {
  const windowStr = formatWindow(data.windowStartAt, data.windowEndAt);
  const verb = data.meetupType === "pickup" ? "pick up" : "return";
  const afterMeetup = data.meetupType === "pickup" ? "picked up" : "returned";
  const itemUrl = appUrl(`/item/${data.itemId}`);
  const contacts = contactLines(data.counterpartyContacts);

  return (
    <SharityEmail preview={`Meetup confirmed for "${data.itemName}"`}>
      <Text
        style={{
          fontSize: "22px",
          fontWeight: "700",
          color: COLORS.heading,
          margin: "0 0 12px",
        }}
      >
        Meetup Confirmed
      </Text>
      <Text style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 8px" }}>
        Hi {data.recipientName},
      </Text>
      <Text
        style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 16px" }}
      >
        Your meetup to{" "}
        <strong>
          {verb} &ldquo;{data.itemName}&rdquo;
        </strong>{" "}
        is confirmed:
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
        <strong>Who to meet:</strong> {data.counterpartyName}
      </Text>
      <Text
        style={{ color: COLORS.body, fontSize: "14px", margin: "0 0 16px" }}
      >
        <strong>Their contact info:</strong>
        <br />
        {contacts}
      </Text>
      <EmailButton href={itemUrl}>View Item</EmailButton>
      <Callout>
        After the meetup, mark the item as {afterMeetup} on the item page to
        complete the handover.
      </Callout>
    </SharityEmail>
  );
}
