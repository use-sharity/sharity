"use client";

import { useState } from "react";

const HIGH_RISK_TOOLS = new Set(["deleteItem", "markMissing"]);

type ToolInput = Record<string, unknown>;

function asToolInput(input: unknown): ToolInput {
  return typeof input === "object" && input !== null
    ? (input as ToolInput)
    : {};
}

function value(input: ToolInput, key: string, fallback = "") {
  const raw = input[key];
  return typeof raw === "string" || typeof raw === "number"
    ? String(raw)
    : fallback;
}

const TOOL_SUMMARIES: Record<string, (input: ToolInput) => string> = {
  createItem: (i) => `Create item "${value(i, "name")}"`,
  updateItem: (i) => `Update "${value(i, "itemName")}"`,
  deleteItem: (i) => `Delete "${value(i, "itemName")}" permanently`,
  approveClaim: (i) => `Approve request on "${value(i, "itemName")}"`,
  rejectClaim: (i) => `Reject request on "${value(i, "itemName")}"`,
  requestItem: (i) =>
    `Request to borrow (${value(i, "startDate")} – ${value(i, "endDate")})`,
  cancelMyClaim: (i) => `Cancel your request on "${value(i, "itemName")}"`,
  proposePickupWindow: (i) => `Propose pickup: ${value(i, "dateTime")}`,
  approvePickupWindow: (i) => `Approve pickup for "${value(i, "itemName")}"`,
  proposeReturnWindow: (i) => `Propose return: ${value(i, "dateTime")}`,
  approveReturnWindow: (i) => `Approve return for "${value(i, "itemName")}"`,
  markPickedUp: (i) => `Confirm pickup of "${value(i, "itemName")}"`,
  markReturned: (i) => `Confirm return of "${value(i, "itemName")}"`,
  markMissing: (i) => `Report "${value(i, "itemName")}" as missing`,
  createRating: (i) => `Submit ${value(i, "stars")}-star rating`,
  createWishlistItem: (i) => `Add wish: "${value(i, "text")}"`,
  updateWishlistItem: (i) => `Update wish: "${value(i, "text")}"`,
  voteWishlistItem: (i) => `Vote on wish: "${value(i, "wishText", "item")}"`,
  deleteWishlistItem: (i) => `Delete wish: "${value(i, "wishText", "item")}"`,
  switchItemMode: (i) =>
    `Switch "${value(i, "itemName")}" to ${i.giveaway ? "giveaway" : "lending"} mode`,
  blockDates: (i) => `Block calendar: ${i.startDate} – ${i.endDate}`,
  unblockDates: () => "Remove blocked dates from your calendar",
  updateProfile: () => "Update your profile",
  markAllNotificationsRead: () => "Mark all notifications as read",
  subscribeToAvailability: () => "Toggle availability alerts for this item",
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
  const toolInput = asToolInput(input);
  const summary = summaryFn ? summaryFn(toolInput) : `Run ${toolName}`;

  if (decided) {
    return (
      <div
        className="rounded-lg px-3 py-2 text-sm"
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
          className="rounded-md px-4 py-1.5 text-sm font-medium"
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
          className="rounded-md px-4 py-1.5 text-sm font-medium"
          style={{ backgroundColor: "#E0D9CE", color: "#1C1C1A" }}
        >
          {isHighRisk ? "Cancel" : "Deny"}
        </button>
      </div>
    </div>
  );
}
