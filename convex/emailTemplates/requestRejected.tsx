import { Text } from "@react-email/components";
import * as React from "react";
import { Callout, EmailButton, SharityEmail, appUrl, COLORS } from "./_shared";
import { t, formatDateLocalized } from "./i18n";
import type { Locale } from "./i18n";

export interface RequestRejectedData {
  borrowerName: string;
  itemName: string;
  startDate: number;
  endDate: number;
  locale: Locale;
}

export function RequestRejectedEmail(data: RequestRejectedData) {
  const dateRange = `${formatDateLocalized(data.startDate, data.locale)} – ${formatDateLocalized(data.endDate, data.locale)}`;

  return (
    <SharityEmail
      preview={t(data.locale, "requestRejected.preview", {
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
        {t(data.locale, "requestRejected.heading")}
      </Text>
      <Text style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 8px" }}>
        {t(data.locale, "requestRejected.greeting", {
          borrowerName: data.borrowerName,
        })}
      </Text>
      <Text
        style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 16px" }}
      >
        {t(data.locale, "requestRejected.body", {
          itemName: data.itemName,
          dateRange,
        })}
      </Text>
      <Callout>{t(data.locale, "requestRejected.callout")}</Callout>
      <EmailButton href={appUrl("/")}>
        {t(data.locale, "requestRejected.cta")}
      </EmailButton>
    </SharityEmail>
  );
}
