import { Text } from "@react-email/components";
import * as React from "react";
import { Callout, EmailButton, SharityEmail, appUrl, COLORS } from "./_shared";
import { t, formatDateLocalized } from "./i18n";
import type { Locale } from "./i18n";

export interface NewRequestData {
  ownerName: string;
  borrowerName: string;
  itemName: string;
  startDate: number;
  endDate: number;
  itemId: string;
  locale: Locale;
}

export function NewRequestEmail(data: NewRequestData) {
  const dateRange = `${formatDateLocalized(data.startDate, data.locale)} – ${formatDateLocalized(data.endDate, data.locale)}`;
  const itemUrl = appUrl(`/item/${data.itemId}`);

  return (
    <SharityEmail
      preview={t(data.locale, "newRequest.preview", {
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
        {t(data.locale, "newRequest.heading")}
      </Text>
      <Text style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 8px" }}>
        {t(data.locale, "newRequest.greeting", { ownerName: data.ownerName })}
      </Text>
      <Text
        style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 16px" }}
      >
        {t(data.locale, "newRequest.body", {
          borrowerName: data.borrowerName,
          itemName: data.itemName,
          dateRange,
        })}
      </Text>
      <Callout>{t(data.locale, "newRequest.callout")}</Callout>
      <EmailButton href={itemUrl}>
        {t(data.locale, "newRequest.cta")}
      </EmailButton>
      <Text
        style={{ color: COLORS.muted, fontSize: "13px", margin: "12px 0 0" }}
      >
        {t(data.locale, "newRequest.footer")}
      </Text>
    </SharityEmail>
  );
}
