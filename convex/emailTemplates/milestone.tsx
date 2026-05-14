import { Text } from "@react-email/components";
import * as React from "react";
import { EmailButton, SharityEmail, appUrl, COLORS } from "./_shared";
import { formatDateLocalized, t } from "./i18n";
import type { Locale } from "./i18n";

export interface ItemReceivedData {
  ownerName: string;
  borrowerName: string;
  itemName: string;
  expectedReturnAt: number;
  itemId: string;
  locale: Locale;
}

export interface ReturnRequestedData {
  ownerName: string;
  borrowerName: string;
  itemName: string;
  itemId: string;
  locale: Locale;
}

export interface ItemReturnedData {
  borrowerName: string;
  itemName: string;
  itemId: string;
  locale: Locale;
}

export function ItemReceivedEmail(data: ItemReceivedData) {
  const itemUrl = appUrl(`/item/${data.itemId}`);
  return (
    <SharityEmail
      preview={t(data.locale, "itemReceived.preview", {
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
        {t(data.locale, "itemReceived.heading")}
      </Text>
      <Text style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 8px" }}>
        {t(data.locale, "itemReceived.greeting", {
          ownerName: data.ownerName,
        })}
      </Text>
      <Text
        style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 16px" }}
      >
        {t(data.locale, "itemReceived.body", {
          borrowerName: data.borrowerName,
          itemName: data.itemName,
          returnDate: formatDateLocalized(data.expectedReturnAt, data.locale),
        })}
      </Text>
      <EmailButton href={itemUrl}>
        {t(data.locale, "shared.openSharity")}
      </EmailButton>
    </SharityEmail>
  );
}

export function ReturnRequestedEmail(data: ReturnRequestedData) {
  const itemUrl = appUrl(`/item/${data.itemId}`);
  return (
    <SharityEmail
      preview={t(data.locale, "returnRequested.preview", {
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
        {t(data.locale, "returnRequested.heading")}
      </Text>
      <Text style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 8px" }}>
        {t(data.locale, "returnRequested.greeting", {
          ownerName: data.ownerName,
        })}
      </Text>
      <Text
        style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 16px" }}
      >
        {t(data.locale, "returnRequested.body", {
          borrowerName: data.borrowerName,
          itemName: data.itemName,
        })}
      </Text>
      <EmailButton href={itemUrl}>
        {t(data.locale, "shared.openSharity")}
      </EmailButton>
    </SharityEmail>
  );
}

export function ItemReturnedEmail(data: ItemReturnedData) {
  const itemUrl = appUrl(`/item/${data.itemId}`);
  return (
    <SharityEmail
      preview={t(data.locale, "itemReturned.preview", {
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
        {t(data.locale, "itemReturned.heading")}
      </Text>
      <Text style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 8px" }}>
        {t(data.locale, "itemReturned.greeting", {
          borrowerName: data.borrowerName,
        })}
      </Text>
      <Text
        style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 16px" }}
      >
        {t(data.locale, "itemReturned.body", {
          itemName: data.itemName,
        })}
      </Text>
      <EmailButton href={itemUrl}>
        {t(data.locale, "shared.openSharity")}
      </EmailButton>
    </SharityEmail>
  );
}
