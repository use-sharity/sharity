import { Link, Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailButton, SharityEmail, COLORS } from "./_shared";
import type { DigestItemSummary } from "./_shared";
import { t, pluralize, formatDateLocalized } from "./i18n";
import type { Locale } from "./i18n";

export interface DigestData {
  userName: string;
  mode: "daily" | "weekly";
  ownerNotifications: DigestItemSummary[];
  borrowerNotifications: DigestItemSummary[];
  generalNotifications: DigestItemSummary[];
  locale: Locale;
}

function DigestSection({
  heading,
  items,
  locale,
}: {
  heading: string;
  items: DigestItemSummary[];
  locale: Locale;
}) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://sharity-dalat.com";
  return (
    <Section style={{ margin: "16px 0 8px" }}>
      <Text
        style={{
          fontSize: "15px",
          fontWeight: "700",
          color: COLORS.heading,
          margin: "0 0 8px",
        }}
      >
        {heading}
      </Text>
      {items.map((item, i) => {
        const url = `${base}/item/${item.itemId}`;
        const summary = item.events
          .map((e) => pluralize(locale, `digest.event.${e.type}`, e.count))
          .join(", ");
        return (
          <Text
            key={i}
            style={{ color: COLORS.body, fontSize: "14px", margin: "4px 0" }}
          >
            •{" "}
            <Link href={url} style={{ color: COLORS.brand }}>
              <strong>{item.itemName}</strong>
            </Link>{" "}
            — {summary}
          </Text>
        );
      })}
    </Section>
  );
}

export function DailyDigestEmail(data: DigestData) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://sharity-dalat.com";
  const today = formatDateLocalized(Date.now(), data.locale);

  const titleKey =
    data.mode === "weekly" ? "digest.title.weekly" : "digest.title.daily";
  const introKey =
    data.mode === "weekly" ? "digest.intro.weekly" : "digest.intro.daily";
  const title = t(data.locale, titleKey, { date: today });

  return (
    <SharityEmail
      preview={t(data.locale, "digest.preview", { date: today })}
      locale={data.locale}
    >
      <Text
        style={{
          fontSize: "22px",
          fontWeight: "700",
          color: COLORS.heading,
          margin: "0 0 8px",
        }}
      >
        {title}
      </Text>
      <Text
        style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 16px" }}
      >
        {t(data.locale, introKey, { userName: data.userName })}
      </Text>
      {data.ownerNotifications.length > 0 && (
        <DigestSection
          heading={t(data.locale, "digest.section.owner")}
          items={data.ownerNotifications}
          locale={data.locale}
        />
      )}
      {data.borrowerNotifications.length > 0 && (
        <DigestSection
          heading={t(data.locale, "digest.section.borrower")}
          items={data.borrowerNotifications}
          locale={data.locale}
        />
      )}
      {data.generalNotifications.length > 0 && (
        <DigestSection
          heading={t(data.locale, "digest.section.general")}
          items={data.generalNotifications}
          locale={data.locale}
        />
      )}
      <EmailButton href={base}>{t(data.locale, "digest.cta")}</EmailButton>
    </SharityEmail>
  );
}
