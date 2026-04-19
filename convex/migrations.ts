import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { buildItemSearchText, buildUserPublicSearchText } from "./searchText";

export const migrations = new Migrations<DataModel>(components.migrations);

export const clearClaimTimestamps = migrations.define({
  table: "claims",
  migrateOne: async (ctx, claim) => {
    // Stop storing lifecycle timestamps on claims; lease_activity is source of truth.
    if (
      claim.requestedAt !== undefined ||
      claim.approvedAt !== undefined ||
      claim.rejectedAt !== undefined ||
      claim.pickedUpAt !== undefined ||
      claim.returnedAt !== undefined ||
      claim.expiredAt !== undefined ||
      claim.missingAt !== undefined
    ) {
      await ctx.db.patch(claim._id, {
        requestedAt: undefined,
        approvedAt: undefined,
        rejectedAt: undefined,
        pickedUpAt: undefined,
        returnedAt: undefined,
        expiredAt: undefined,
        missingAt: undefined,
      });
    }
  },
});

export const backfillItemSearchText = migrations.define({
  table: "items",
  migrateOne: async (ctx, item) => {
    const searchText = buildItemSearchText({
      name: item.name,
      description: item.description,
    });
    if (item.searchText !== searchText) {
      await ctx.db.patch(item._id, { searchText });
    }
  },
});

export const backfillUserPublicSearchText = migrations.define({
  table: "users",
  migrateOne: async (ctx, user) => {
    const publicSearchText = buildUserPublicSearchText({ name: user.name });
    if (user.publicSearchText !== publicSearchText) {
      await ctx.db.patch(user._id, { publicSearchText });
    }
  },
});

export const run = migrations.runner([
  internal.migrations.clearClaimTimestamps,
  internal.migrations.backfillItemSearchText,
  internal.migrations.backfillUserPublicSearchText,
]);
