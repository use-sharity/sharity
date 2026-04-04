import { Link, Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailButton, SharityEmail, COLORS } from "./_shared";
import type { DigestItemSummary } from "./_shared";

export interface DigestData {
	userName: string;
	ownerNotifications: DigestItemSummary[];
	borrowerNotifications: DigestItemSummary[];
	generalNotifications: DigestItemSummary[];
}

const NOTIFICATION_LABELS: Record<
	string,
	{ singular: string; plural: string }
> = {
	new_request: { singular: "new request", plural: "new requests" },
	request_approved: {
		singular: "request approved",
		plural: "requests approved",
	},
	request_rejected: {
		singular: "request rejected",
		plural: "requests rejected",
	},
	item_available: { singular: "now available", plural: "now available" },
	pickup_proposed: { singular: "pickup proposed", plural: "pickups proposed" },
	pickup_approved: { singular: "pickup approved", plural: "pickups approved" },
	pickup_expired: { singular: "pickup expired", plural: "pickups expired" },
	return_proposed: { singular: "return proposed", plural: "returns proposed" },
	return_approved: { singular: "return approved", plural: "returns approved" },
	return_missing: { singular: "overdue return", plural: "overdue returns" },
	rate_transaction: {
		singular: "rating requested",
		plural: "ratings requested",
	},
	rating_received: { singular: "rating received", plural: "ratings received" },
};

function eventLabel(type: string, count: number): string {
	const labels = NOTIFICATION_LABELS[type];
	if (!labels) return `${count} ${type}`;
	return `${count} ${count === 1 ? labels.singular : labels.plural}`;
}

function DigestSection({
	heading,
	items,
}: {
	heading: string;
	items: DigestItemSummary[];
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
					.map((e) => eventLabel(e.type, e.count))
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
				<DigestSection heading="As Owner" items={data.ownerNotifications} />
			)}
			{data.borrowerNotifications.length > 0 && (
				<DigestSection
					heading="As Borrower"
					items={data.borrowerNotifications}
				/>
			)}
			{data.generalNotifications.length > 0 && (
				<DigestSection heading="General" items={data.generalNotifications} />
			)}
			<EmailButton href={base}>Go to Sharity</EmailButton>
		</SharityEmail>
	);
}
