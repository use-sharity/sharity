import { query } from "./_generated/server";

export const getUserContext = query({
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return null;
		const userId = identity.subject;

		const myItems = await ctx.db
			.query("items")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.collect();

		const myClaims = await ctx.db
			.query("claims")
			.withIndex("by_claimer", (q) => q.eq("claimerId", userId))
			.collect();

		const claimsOnMyItems = [];
		for (const item of myItems) {
			const claims = await ctx.db
				.query("claims")
				.withIndex("by_item", (q) => q.eq("itemId", item._id))
				.collect();
			claimsOnMyItems.push(...claims);
		}

		const pendingOnMyItems = claimsOnMyItems.filter(
			(c) => c.status === "pending",
		);
		const activeBorrows = myClaims.filter(
			(c) =>
				c.status === "approved" &&
				c.pickedUpAt != null &&
				c.returnedAt == null &&
				c.transferredAt == null,
		);

		let stage: string = "active_user";
		if (myItems.length === 0 && myClaims.length === 0) {
			stage = "new_user";
		} else if (
			myItems.length > 0 &&
			claimsOnMyItems.length === 0 &&
			myClaims.length === 0
		) {
			stage = "has_items_no_activity";
		} else if (pendingOnMyItems.length > 0) {
			stage = "has_pending_claims";
		}

		return {
			stage,
			itemCount: myItems.length,
			activeBorrows: activeBorrows.length,
			pendingClaimsOnMyItems: pendingOnMyItems.length,
			pendingMyRequests: myClaims.filter((c) => c.status === "pending").length,
		};
	},
});
