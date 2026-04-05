import { Section, Text } from "@react-email/components";
import * as React from "react";
import {
  EmailButton,
  SharityEmail,
  appUrl,
  contactLines,
  formatDate,
  COLORS,
} from "./_shared";
import type { ContactInfo } from "./_shared";

export interface OverdueAlertData {
  recipientName: string;
  itemName: string;
  originalEndDate: number;
  counterpartyName: string;
  counterpartyContacts: ContactInfo;
  itemId: string;
  role: "owner" | "borrower";
}

export function OverdueAlertEmail(data: OverdueAlertData) {
  const dueDateStr = formatDate(data.originalEndDate);
  const itemUrl = appUrl(`/item/${data.itemId}`);
  const contacts = contactLines(data.counterpartyContacts);

  const headline =
    data.role === "owner"
      ? `"${data.itemName}" has not been returned`
      : `You have an overdue item: "${data.itemName}"`;

  const body =
    data.role === "owner"
      ? `The return window has passed (due ${dueDateStr}). Please contact the borrower to arrange the return.`
      : `Your borrow of ${data.itemName} was due back on ${dueDateStr}. Please contact the owner to arrange the return as soon as possible.`;

  return (
    <SharityEmail preview={`Action needed: "${data.itemName}" is overdue`}>
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
          Overdue Item
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
        Hi {data.recipientName},
      </Text>
      <Text
        style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 16px" }}
      >
        {body}
      </Text>
      <Text style={{ color: COLORS.body, fontSize: "14px", margin: "0 0 4px" }}>
        <strong>Contact {data.counterpartyName}:</strong>
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
      <EmailButton href={itemUrl}>View Item</EmailButton>
      <Section
        style={{
          backgroundColor: COLORS.card,
          borderRadius: "6px",
          padding: "12px 16px",
          margin: "16px 0 0",
        }}
      >
        <Text style={{ color: COLORS.body, fontSize: "14px", margin: "0" }}>
          If you cannot reach the other party, please contact Sharity support.
        </Text>
      </Section>
    </SharityEmail>
  );
}
