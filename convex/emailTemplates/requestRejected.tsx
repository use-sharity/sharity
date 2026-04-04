import { Text } from "@react-email/components";
import * as React from "react";
import {
	Callout,
	EmailButton,
	SharityEmail,
	appUrl,
	formatDate,
	COLORS,
} from "./_shared";

export interface RequestRejectedData {
	borrowerName: string;
	itemName: string;
	startDate: number;
	endDate: number;
}

export function RequestRejectedEmail(data: RequestRejectedData) {
	const dateRange = `${formatDate(data.startDate)} – ${formatDate(data.endDate)}`;

	return (
		<SharityEmail
			preview={`Your request for "${data.itemName}" was not approved`}
		>
			<Text
				style={{
					fontSize: "22px",
					fontWeight: "700",
					color: COLORS.heading,
					margin: "0 0 12px",
				}}
			>
				Request Not Approved
			</Text>
			<Text style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 8px" }}>
				Hi {data.borrowerName},
			</Text>
			<Text
				style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 16px" }}
			>
				Unfortunately, the owner declined your request for{" "}
				<strong>{data.itemName}</strong> ({dateRange}).
			</Text>
			<Callout>
				Don&apos;t worry — there are plenty of other items available on Sharity.
				Browse the catalogue to find what you need.
			</Callout>
			<EmailButton href={appUrl("/")}>Browse Other Items</EmailButton>
		</SharityEmail>
	);
}
