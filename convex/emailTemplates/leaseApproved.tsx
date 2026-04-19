import { Text } from "@react-email/components";
import * as React from "react";
import { Callout, EmailButton, SharityEmail, appUrl, COLORS } from "./_shared";
import { t, formatDateLocalized } from "./i18n";
import type { Locale } from "./i18n";

export interface LeaseApprovedData {
  borrowerName: string;
  itemName: string;
  startDate: number;
  endDate: number;
  claimId: string;
  itemId: string;
  locale: Locale;
}

export function LeaseApprovedEmail(data: LeaseApprovedData) {
  const dateRange = `${formatDateLocalized(data.startDate, data.locale)} – ${formatDateLocalized(data.endDate, data.locale)}`;
  const itemUrl = appUrl(`/item/${data.itemId}`);

  return (
    <SharityEmail
      preview={t(data.locale, "leaseApproved.preview", {
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
        {t(data.locale, "leaseApproved.heading")}
      </Text>
      <Text style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 8px" }}>
        {t(data.locale, "leaseApproved.greeting", {
          borrowerName: data.borrowerName,
        })}
      </Text>
      <Text
        style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 16px" }}
      >
        {t(data.locale, "leaseApproved.body", {
          itemName: data.itemName,
          dateRange,
        })}
      </Text>
      <Callout>{t(data.locale, "leaseApproved.callout")}</Callout>
      <EmailButton href={itemUrl}>
        {t(data.locale, "leaseApproved.cta")}
      </EmailButton>
      <Text
        style={{ color: COLORS.muted, fontSize: "13px", margin: "12px 0 0" }}
      >
        {t(data.locale, "leaseApproved.footer")}
      </Text>
    </SharityEmail>
  );
}
