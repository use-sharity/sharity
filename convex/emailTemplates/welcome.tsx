import { Section, Text } from "@react-email/components";
import * as React from "react";
import { Callout, EmailButton, SharityEmail, appUrl, COLORS } from "./_shared";
import { t } from "./i18n";
import type { Locale } from "./i18n";

export interface WelcomeEmailProps {
  name: string;
  locale: Locale;
}

export function WelcomeEmail({ name, locale }: WelcomeEmailProps) {
  return (
    <SharityEmail
      preview={t(locale, "welcome.preview", { name })}
      locale={locale}
    >
      <Text
        style={{
          fontSize: "22px",
          fontWeight: "700",
          color: COLORS.heading,
          margin: "0 0 8px",
        }}
      >
        {t(locale, "welcome.heading", { name })}
      </Text>
      <Text
        style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 16px" }}
      >
        {t(locale, "welcome.intro")}
      </Text>
      <Text style={{ color: COLORS.body, fontSize: "14px", margin: "0 0 4px" }}>
        {t(locale, "welcome.canDoIntro")}
      </Text>
      <Section style={{ margin: "8px 0 16px", paddingLeft: "16px" }}>
        <Text style={{ color: COLORS.body, fontSize: "14px", margin: "4px 0" }}>
          • {t(locale, "welcome.bullet.browse")}
        </Text>
        <Text style={{ color: COLORS.body, fontSize: "14px", margin: "4px 0" }}>
          • {t(locale, "welcome.bullet.list")}
        </Text>
        <Text style={{ color: COLORS.body, fontSize: "14px", margin: "4px 0" }}>
          • {t(locale, "welcome.bullet.request")}
        </Text>
      </Section>
      <EmailButton href={appUrl("/")}>{t(locale, "welcome.cta")}</EmailButton>
      <Callout>{t(locale, "welcome.callout")}</Callout>
    </SharityEmail>
  );
}
