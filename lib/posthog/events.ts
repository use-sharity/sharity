import posthog from "posthog-js";

export const EVENTS = {
  ITEM_LISTED: "item_listed",
  CLAIM_REQUESTED: "claim_requested",
  EXCHANGE_COMPLETED: "exchange_completed",
} as const;

export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type ItemListedProps = {
  item_id: string;
  has_images: boolean;
  mode: "lease" | "giveaway";
};

type ClaimRequestedProps = {
  item_id: string;
  duration_days: number;
};

type ExchangeCompletedProps = {
  item_id: string;
  claim_id: string;
  is_giveaway: boolean;
  days_since_approval: number;
};

export function trackItemListed(props: ItemListedProps): void {
  posthog.capture(EVENTS.ITEM_LISTED, props);
}

export function trackClaimRequested(props: ClaimRequestedProps): void {
  posthog.capture(EVENTS.CLAIM_REQUESTED, props);
}

export function trackExchangeCompleted(props: ExchangeCompletedProps): void {
  posthog.capture(EVENTS.EXCHANGE_COMPLETED, props);
}
