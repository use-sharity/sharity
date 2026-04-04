import { Section, Text } from "@react-email/components";
import * as React from "react";
import {
	Callout,
	EmailButton,
	SharityEmail,
	appUrl,
	formatWindow,
	COLORS,
} from "./_shared";

export interface MeetupProposedData {
	recipientName: string;
	proposerName: string;
	itemName: string;
	windowStartAt: number;
	windowEndAt: number;
	itemId: string;
	meetupType: "pickup" | "return";
}

export function MeetupProposedEmail(data: MeetupProposedData) {
	const windowStr = formatWindow(data.windowStartAt, data.windowEndAt);
	const verb = data.meetupType === "pickup" ? "pick up" : "return";
	const itemUrl = appUrl(`/item/${data.itemId}`);

	return (
		<SharityEmail
			preview={`${data.meetupType === "pickup" ? "Pickup" : "Return"} time proposed for "${data.itemName}"`}
		>
			<Text
				style={{
					fontSize: "22px",
					fontWeight: "700",
					color: COLORS.heading,
					margin: "0 0 12px",
				}}
			>
				{data.meetupType === "pickup" ? "Pickup" : "Return"} Time Proposed
			</Text>
			<Text style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 8px" }}>
				Hi {data.recipientName},
			</Text>
			<Text
				style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 16px" }}
			>
				<strong>{data.proposerName}</strong> proposed a time to {verb}{" "}
				<strong>&ldquo;{data.itemName}&rdquo;</strong>:
			</Text>
			<Section
				style={{
					backgroundColor: COLORS.card,
					borderRadius: "6px",
					padding: "12px 16px",
					margin: "0 0 16px",
					textAlign: "center" as const,
				}}
			>
				<Text
					style={{
						fontSize: "16px",
						fontWeight: "700",
						color: COLORS.heading,
						margin: "0",
					}}
				>
					{windowStr}
				</Text>
			</Section>
			<Callout>
				Review and approve this time so both parties can confirm the meetup.
			</Callout>
			<EmailButton href={itemUrl}>Review &amp; Approve</EmailButton>
			<Text
				style={{ color: COLORS.muted, fontSize: "13px", margin: "12px 0 0" }}
			>
				If this time doesn&apos;t work, you can propose a different window on
				the item page.
			</Text>
		</SharityEmail>
	);
}
