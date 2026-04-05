import { Text } from "@react-email/components";
import * as React from "react";
import {
  Callout,
  EmailButton,
  SharityEmail,
  appUrl,
  formatDate,
  COLORS,
} from "./_shared";

export interface NewRequestData {
  ownerName: string;
  borrowerName: string;
  itemName: string;
  startDate: number;
  endDate: number;
  itemId: string;
}

export function NewRequestEmail(data: NewRequestData) {
  const dateRange = `${formatDate(data.startDate)} – ${formatDate(data.endDate)}`;
  const itemUrl = appUrl(`/item/${data.itemId}`);

  return (
    <SharityEmail preview={`New request for "${data.itemName}"`}>
      <Text
        style={{
          fontSize: "22px",
          fontWeight: "700",
          color: COLORS.heading,
          margin: "0 0 12px",
        }}
      >
        New Borrow Request
      </Text>
      <Text style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 8px" }}>
        Hi {data.ownerName},
      </Text>
      <Text
        style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 16px" }}
      >
        <strong>{data.borrowerName}</strong> wants to borrow your item{" "}
        <strong>{data.itemName}</strong> for <strong>{dateRange}</strong>.
      </Text>
      <Callout>
        Review the request and approve or decline it so the borrower can plan
        ahead.
      </Callout>
      <EmailButton href={itemUrl}>Review Request</EmailButton>
      <Text
        style={{ color: COLORS.muted, fontSize: "13px", margin: "12px 0 0" }}
      >
        You have up to the start date to respond. Unanswered requests expire
        automatically.
      </Text>
    </SharityEmail>
  );
}
