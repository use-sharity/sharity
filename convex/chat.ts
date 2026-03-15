import { v } from "convex/values";
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

		const fosteringItemNames: string[] = [];
		for (const claim of activeBorrows) {
			const item = await ctx.db.get(claim.itemId);
			if (item) fosteringItemNames.push(item.name);
		}

		return {
			stage,
			itemCount: myItems.length,
			itemNames: myItems.map((i) => i.name),
			activeBorrows: activeBorrows.length,
			fosteringItemNames,
			pendingClaimsOnMyItems: pendingOnMyItems.length,
			pendingMyRequests: myClaims.filter((c) => c.status === "pending").length,
		};
	},
});

export const getClaimsOnItem = query({
	args: { itemName: v.string() },
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return null;
		const userId = identity.subject;

		const myItems = await ctx.db
			.query("items")
			.withIndex("by_owner", (q) => q.eq("ownerId", userId))
			.collect();

		const q = args.itemName.toLowerCase();
		const matches = myItems.filter((i) => i.name.toLowerCase().includes(q));

		if (matches.length === 0) {
			return {
				found: false as const,
				items: myItems.map((i) => i.name),
			};
		}
		if (matches.length > 1) {
			return {
				found: "multiple" as const,
				items: matches.map((i) => i.name),
			};
		}

		const item = matches[0];
		const claims = await ctx.db
			.query("claims")
			.withIndex("by_item", (q2) => q2.eq("itemId", item._id))
			.collect();

		const enriched = await Promise.all(
			claims.map(async (c) => {
				const users = await ctx.db
					.query("users")
					.filter((q2) => q2.eq(q2.field("clerkId"), c.claimerId))
					.first();
				return {
					claimerName: users?.name ?? "a neighbor",
					claimerId: c.claimerId,
					status: c.status,
					startDate: c.startDate,
					endDate: c.endDate,
				};
			}),
		);

		return { found: true as const, itemName: item.name, claims: enriched };
	},
});
