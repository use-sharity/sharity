import { Text } from "@react-email/components";
import * as React from "react";
import { Callout, EmailButton, SharityEmail, appUrl, COLORS } from "./_shared";

export interface ItemAvailableData {
	recipientName: string;
	itemName: string;
	itemId: string;
}

export function ItemAvailableEmail(data: ItemAvailableData) {
	const itemUrl = appUrl(`/item/${data.itemId}`);

	return (
		<SharityEmail preview={`"${data.itemName}" is available again!`}>
			<Text
				style={{
					fontSize: "22px",
					fontWeight: "700",
					color: COLORS.heading,
					margin: "0 0 12px",
				}}
			>
				Item Available!
			</Text>
			<Text style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 8px" }}>
				Hi {data.recipientName},
			</Text>
			<Text
				style={{ color: COLORS.body, fontSize: "15px", margin: "0 0 16px" }}
			>
				Great news — <strong>{data.itemName}</strong>, the item you were
				watching, is available again.
			</Text>
			<Callout>
				Items can be claimed quickly. Request it now before someone else does!
			</Callout>
			<EmailButton href={itemUrl}>Request It Now</EmailButton>
		</SharityEmail>
	);
}
