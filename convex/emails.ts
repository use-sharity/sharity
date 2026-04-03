import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

// ─── Idempotency queries/mutations ────────────────────────────────────────────

export const hasEmailBeenSent = internalQuery({
	args: { key: v.string() },
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("email_log")
			.withIndex("by_key", (q) => q.eq("key", args.key))
			.first();
		return existing !== null;
	},
});

export const logEmail = internalMutation({
	args: { key: v.string() },
	handler: async (ctx, args) => {
		await ctx.db.insert("email_log", { key: args.key, sentAt: Date.now() });
	},
});

export const buildDigestPayloads = internalQuery({
	args: {},
	handler: async (ctx) => {
		const since = Date.now() - 24 * 60 * 60 * 1000;

		const recentNotifications = await ctx.db
			.query("notifications")
			.filter((q) =>
				q.and(
					q.eq(q.field("isRead"), false),
					q.gte(q.field("createdAt"), since),
				),
			)
			.collect();

		// Group by recipientId
		const byRecipient = new Map<string, typeof recentNotifications>();
		for (const n of recentNotifications) {
			const list = byRecipient.get(n.recipientId) ?? [];
			list.push(n);
			byRecipient.set(n.recipientId, list);
		}

		const OWNER_TYPES = new Set([
			"new_request",
			"return_proposed",
			"pickup_expired",
			"return_missing",
		]);
		const BORROWER_TYPES = new Set([
			"request_approved",
			"request_rejected",
			"item_available",
			"pickup_proposed",
			"return_approved",
		]);

		const results: Array<{
			clerkId: string;
			email: string;
			data: {
				userName: string;
				ownerNotifications: Array<{
					type: string;
					itemName: string;
					createdAt: number;
					itemId: string;
				}>;
				borrowerNotifications: Array<{
					type: string;
					itemName: string;
					createdAt: number;
					itemId: string;
				}>;
				generalNotifications: Array<{
					type: string;
					itemName: string;
					createdAt: number;
					itemId: string;
				}>;
			};
		}> = [];

		for (const [clerkId, notifications] of byRecipient) {
			const userRecord = await ctx.db
				.query("users")
				.withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
				.first();

			if (!userRecord?.email) continue;

			const ownerNotifications = [];
			const borrowerNotifications = [];
			const generalNotifications = [];

			for (const n of notifications) {
				const item = await ctx.db.get(n.itemId);
				const entry = {
					type: n.type,
					itemName: item?.name ?? "Unknown item",
					createdAt: n.createdAt,
					itemId: n.itemId,
				};

				if (OWNER_TYPES.has(n.type)) ownerNotifications.push(entry);
				else if (BORROWER_TYPES.has(n.type)) borrowerNotifications.push(entry);
				else generalNotifications.push(entry);
			}

			results.push({
				clerkId,
				email: userRecord.email,
				data: {
					userName: userRecord.name ?? "there",
					ownerNotifications,
					borrowerNotifications,
					generalNotifications,
				},
			});
		}

		return results;
	},
});
