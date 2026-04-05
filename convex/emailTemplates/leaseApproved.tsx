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

export interface LeaseApprovedData {
  borrowerName: string;
  itemName: string;
  startDate: number;
  endDate: number;
  claimId: string;
  itemId: string;
}

export function LeaseApprovedEmail(data: LeaseApprovedData) {
  const dateRange = `${formatDate(data.startDate)} – ${formatDate(data.endDate)}`;
  const itemUrl = appUrl(`/item/${data.itemId}`);

  return (
    <SharityEmail preview={`Your request for "${data.itemName}" was approved`}>
      <Text
        style={{
          fontSize: "22px",
          fontWeight: "700",
          color: COLORS.heading,
          margin: "0 0 12px",
        }}
      >
        Request Approved
      </Text>
      <Text style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 8px" }}>
        Hi {data.borrowerName},
      </Text>
      <Text
        style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 16px" }}
      >
        Your request for <strong>{data.itemName}</strong> has been approved for{" "}
        <strong>{dateRange}</strong>.
      </Text>
      <Callout>
        <strong>Next step:</strong> Propose a pickup window so you and the owner
        can coordinate the handover.
      </Callout>
      <EmailButton href={itemUrl}>Propose Pickup Time</EmailButton>
      <Text
        style={{ color: COLORS.muted, fontSize: "13px", margin: "12px 0 0" }}
      >
        If you can no longer make it, you can cancel your request on the item
        page.
      </Text>
    </SharityEmail>
  );
}
