import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { DigestItemSummary } from "./emailTemplates/_shared";

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
				ownerNotifications: DigestItemSummary[];
				borrowerNotifications: DigestItemSummary[];
				generalNotifications: DigestItemSummary[];
			};
		}> = [];

		for (const [clerkId, notifications] of byRecipient) {
			const userRecord = await ctx.db
				.query("users")
				.withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
				.first();

			if (!userRecord?.email) continue;

			// counts keyed by `bucket:itemId:type`
			const ownerCounts = new Map<string, Map<string, number>>();
			const borrowerCounts = new Map<string, Map<string, number>>();
			const generalCounts = new Map<string, Map<string, number>>();
			const itemNames = new Map<string, string>();

			for (const n of notifications) {
				const itemId = n.itemId as string;
				if (!itemNames.has(itemId)) {
					const item = await ctx.db.get(n.itemId);
					itemNames.set(itemId, item?.name ?? "Unknown item");
				}

				let bucket: Map<string, Map<string, number>>;
				if (OWNER_TYPES.has(n.type)) bucket = ownerCounts;
				else if (BORROWER_TYPES.has(n.type)) bucket = borrowerCounts;
				else bucket = generalCounts;

				const byType = bucket.get(itemId) ?? new Map<string, number>();
				byType.set(n.type, (byType.get(n.type) ?? 0) + 1);
				bucket.set(itemId, byType);
			}

			const toSummaries = (
				counts: Map<string, Map<string, number>>,
			): DigestItemSummary[] =>
				[...counts.entries()].map(([itemId, byType]) => ({
					itemName: itemNames.get(itemId) ?? "Unknown item",
					itemId,
					events: [...byType.entries()].map(([type, count]) => ({
						type,
						count,
					})),
				}));

			results.push({
				clerkId,
				email: userRecord.email,
				data: {
					userName: userRecord.name ?? "there",
					ownerNotifications: toSummaries(ownerCounts),
					borrowerNotifications: toSummaries(borrowerCounts),
					generalNotifications: toSummaries(generalCounts),
				},
			});
		}

		return results;
	},
});
