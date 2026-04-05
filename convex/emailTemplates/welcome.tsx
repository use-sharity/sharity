import { Link, Section, Text } from "@react-email/components";
import * as React from "react";
import { Callout, EmailButton, SharityEmail, appUrl, COLORS } from "./_shared";

interface WelcomeEmailProps {
  name: string;
}

export function WelcomeEmail({ name }: WelcomeEmailProps) {
  return (
    <SharityEmail preview={`Welcome to Sharity, ${name}!`}>
      <Text
        style={{
          fontSize: "22px",
          fontWeight: "700",
          color: COLORS.heading,
          margin: "0 0 8px",
        }}
      >
        Hey {name}!
      </Text>
      <Text
        style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 16px" }}
      >
        Welcome to <strong>Sharity</strong> — a community where neighbours share
        things they own but rarely use.
      </Text>
      <Text style={{ color: COLORS.body, fontSize: "14px", margin: "0 0 4px" }}>
        Here&apos;s what you can do:
      </Text>
      <Section style={{ margin: "8px 0 16px", paddingLeft: "16px" }}>
        <Text style={{ color: COLORS.body, fontSize: "14px", margin: "4px 0" }}>
          • <strong>Browse items</strong> — find something you need without
          buying it
        </Text>
        <Text style={{ color: COLORS.body, fontSize: "14px", margin: "4px 0" }}>
          • <strong>List your stuff</strong> — put idle items to good use
        </Text>
        <Text style={{ color: COLORS.body, fontSize: "14px", margin: "4px 0" }}>
          • <strong>Request a loan</strong> — pick dates, get approved, arrange
          pickup
        </Text>
      </Section>
      <EmailButton href={appUrl("/")}>Explore Items</EmailButton>
      <Callout>
        <strong>No money changes hands.</strong> Sharity runs on trust and
        community goodwill.
      </Callout>
    </SharityEmail>
  );
}
