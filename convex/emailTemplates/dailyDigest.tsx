import { Link, Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailButton, SharityEmail, COLORS } from "./_shared";
import type { DigestNotification } from "./_shared";

export interface DigestData {
	userName: string;
	ownerNotifications: DigestNotification[];
	borrowerNotifications: DigestNotification[];
	generalNotifications: DigestNotification[];
}

const NOTIFICATION_LABELS: Record<string, string> = {
	new_request: "New borrow request",
	request_approved: "Request approved",
	request_rejected: "Request rejected",
	item_available: "Item now available",
	pickup_proposed: "Pickup window proposed",
	pickup_approved: "Pickup window approved",
	pickup_expired: "Pickup window expired",
	return_proposed: "Return window proposed",
	return_approved: "Return window approved",
	return_missing: "Item not returned (overdue)",
	rate_transaction: "Please rate this transaction",
	rating_received: "You received a rating",
};

function DigestSection({
	heading,
	notifications,
}: {
	heading: string;
	notifications: DigestNotification[];
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
			{notifications.map((n, i) => {
				const label = NOTIFICATION_LABELS[n.type] ?? n.type;
				const url = `${base}/item/${n.itemId}`;
				return (
					<Text
						key={i}
						style={{ color: COLORS.body, fontSize: "14px", margin: "4px 0" }}
					>
						• <strong>{label}</strong> —{" "}
						<Link href={url} style={{ color: COLORS.brand }}>
							{n.itemName}
						</Link>
					</Text>
				);
			})}
		</Section>
	);
}

export function DailyDigestEmail(data: DigestData) {
	const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://sharity-dalat.com";
	const today = new Date().toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
	});

	return (
		<SharityEmail preview={`Your Sharity activity — ${today}`}>
			<Text
				style={{
					fontSize: "22px",
					fontWeight: "700",
					color: COLORS.heading,
					margin: "0 0 8px",
				}}
			>
				Daily Summary — {today}
			</Text>
			<Text
				style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 16px" }}
			>
				Hi {data.userName}, here&apos;s what happened on Sharity in the last 24
				hours:
			</Text>
			{data.ownerNotifications.length > 0 && (
				<DigestSection
					heading="As Owner"
					notifications={data.ownerNotifications}
				/>
			)}
			{data.borrowerNotifications.length > 0 && (
				<DigestSection
					heading="As Borrower"
					notifications={data.borrowerNotifications}
				/>
			)}
			{data.generalNotifications.length > 0 && (
				<DigestSection
					heading="General"
					notifications={data.generalNotifications}
				/>
			)}
			<EmailButton href={base}>Go to Sharity</EmailButton>
		</SharityEmail>
	);
}
