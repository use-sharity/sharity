import type { Id } from "@/convex/_generated/dataModel";
import type { CloudinaryRef } from "@/lib/cloudinary-ref";

export type ViewerRole = "owner" | "borrower";

export type ApproveClaimArgs = { claimId: Id<"claims">; id: Id<"items"> };
export type RejectClaimArgs = { claimId: Id<"claims">; id: Id<"items"> };
export type CancelClaimArgs = { claimId: Id<"claims"> };
export type MutationResult = Promise<null | void>;

export type RecordLeaseArgs = {
  itemId: Id<"items">;
  claimId: Id<"claims">;
  note?: string;
  photoCloudinary?: CloudinaryRef[];
};

export type MarkLeaseStatusArgs = {
  itemId: Id<"items">;
  claimId: Id<"claims">;
  note?: string;
};
