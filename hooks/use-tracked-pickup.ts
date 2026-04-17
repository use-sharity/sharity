import { useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { trackExchangeCompleted, ONE_DAY_MS } from "@/lib/posthog/events";
import type { RecordPickupArgs } from "@/components/lease/lease-claim-types";

export function useTrackedPickup(): (
  args: RecordPickupArgs,
) => Promise<null | void> {
  const markPickedUp = useMutation(api.items.markPickedUp);

  return useCallback(
    async ({ isGiveaway, approvedAt, ...mutationArgs }: RecordPickupArgs) => {
      const result = await markPickedUp(mutationArgs);
      const daysSinceApproval =
        approvedAt != null
          ? Math.round((Date.now() - approvedAt) / ONE_DAY_MS)
          : 0;
      trackExchangeCompleted({
        item_id: mutationArgs.itemId,
        claim_id: mutationArgs.claimId,
        is_giveaway: isGiveaway ?? false,
        days_since_approval: daysSinceApproval,
      });
      return result;
    },
    [markPickedUp],
  );
}
