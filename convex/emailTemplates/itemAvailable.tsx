import { Text } from "@react-email/components";
import * as React from "react";
import { Callout, EmailButton, SharityEmail, appUrl, COLORS } from "./_shared";
import { t } from "./i18n";
import type { Locale } from "./i18n";

export interface ItemAvailableData {
  recipientName: string;
  itemName: string;
  itemId: string;
  locale: Locale;
}

export function ItemAvailableEmail(data: ItemAvailableData) {
  const itemUrl = appUrl(`/item/${data.itemId}`);

  return (
    <SharityEmail
      preview={t(data.locale, "itemAvailable.preview", {
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
        {t(data.locale, "itemAvailable.heading")}
      </Text>
      <Text style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 8px" }}>
        {t(data.locale, "itemAvailable.greeting", {
          recipientName: data.recipientName,
        })}
      </Text>
      <Text
        style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 16px" }}
      >
        {t(data.locale, "itemAvailable.body", { itemName: data.itemName })}
      </Text>
      <Callout>{t(data.locale, "itemAvailable.callout")}</Callout>
      <EmailButton href={itemUrl}>
        {t(data.locale, "itemAvailable.cta")}
      </EmailButton>
    </SharityEmail>
  );
}
