"use client";

import { useState } from "react";

const HIGH_RISK_TOOLS = new Set(["deleteItem", "markMissing"]);

const TOOL_SUMMARIES: Record<string, (input: any) => string> = {
	createItem: (i) => `Create item "${i.name}"`,
	updateItem: (i) => `Update "${i.itemName}"`,
	deleteItem: (i) => `Delete "${i.itemName}" permanently`,
	approveClaim: (i) => `Approve request on "${i.itemName}"`,
	rejectClaim: (i) => `Reject request on "${i.itemName}"`,
	requestItem: (i) => `Request to borrow (${i.startDate} – ${i.endDate})`,
	cancelMyClaim: (i) => `Cancel your request on "${i.itemName}"`,
	proposePickupWindow: (i) => `Propose pickup: ${i.dateTime}`,
	approvePickupWindow: (i) => `Approve pickup for "${i.itemName}"`,
	proposeReturnWindow: (i) => `Propose return: ${i.dateTime}`,
	approveReturnWindow: (i) => `Approve return for "${i.itemName}"`,
	markPickedUp: (i) => `Confirm pickup of "${i.itemName}"`,
	markReturned: (i) => `Confirm return of "${i.itemName}"`,
	markMissing: (i) => `Report "${i.itemName}" as missing`,
	createRating: (i) => `Submit ${i.stars}-star rating`,
	createWishlistItem: (i) => `Add wish: "${i.text}"`,
};

interface ToolApprovalCardProps {
	toolName: string;
	input: unknown;
	approvalId: string;
	onApprove: (id: string) => void;
	onDeny: (id: string) => void;
}

export function ToolApprovalCard({
	toolName,
	input,
	approvalId,
	onApprove,
	onDeny,
}: ToolApprovalCardProps) {
	const [decided, setDecided] = useState<"approved" | "denied" | null>(null);

	const isHighRisk = HIGH_RISK_TOOLS.has(toolName);
	const summaryFn = TOOL_SUMMARIES[toolName];
	const summary = summaryFn ? summaryFn(input) : `Run ${toolName}`;

	if (decided) {
		return (
			<div
				className="rounded-lg px-3 py-2 text-xs"
				style={{ color: "#7A7570" }}
			>
				{decided === "approved" ? "✓ Approved" : "✗ Denied"}
			</div>
		);
	}

	return (
		<div
			className="my-2 rounded-lg border px-3 py-2"
			style={{ borderColor: "#E0D9CE", backgroundColor: "#FDFCFA" }}
		>
			<div className="mb-1 text-sm" style={{ color: "#1C1C1A" }}>
				{summary}
			</div>
			{isHighRisk && (
				<div className="mb-2 text-xs" style={{ color: "#B91C1C" }}>
					This cannot be undone
				</div>
			)}
			<div className="flex gap-2">
				<button
					type="button"
					onClick={() => {
						setDecided("approved");
						onApprove(approvalId);
					}}
					className="rounded-md px-3 py-1 text-xs font-medium"
					style={{
						backgroundColor: isHighRisk ? "#B91C1C" : "#2D4A35",
						color: "#F0EBE0",
					}}
				>
					{isHighRisk ? "Confirm" : "Approve"}
				</button>
				<button
					type="button"
					onClick={() => {
						setDecided("denied");
						onDeny(approvalId);
					}}
					className="rounded-md px-3 py-1 text-xs font-medium"
					style={{ backgroundColor: "#E0D9CE", color: "#1C1C1A" }}
				>
					{isHighRisk ? "Cancel" : "Deny"}
				</button>
			</div>
		</div>
	);
}
