import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// The ONLY two real Google-authenticated users
const USER_A = "user_38gb4lqLetM0bfE5ChI8DYn5ZLN";
const USER_B = "user_38Te2S572G8xjj9FNCq8szncRAl";

/**
 * Debug: Check current user's identity and what items they should see.
 */
export const debugCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();

		if (!identity) {
			return {
				authenticated: false,
				message: "Not logged in - seeing ALL items",
			};
		}

		const items = await ctx.db.query("items").collect();
		const myItems = items.filter((i) => i.ownerId === identity.subject);
		const otherItems = items.filter((i) => i.ownerId !== identity.subject);

		return {
			authenticated: true,
			userId: identity.subject,
			isUserA: identity.subject === USER_A,
			isUserB: identity.subject === USER_B,
			myItems: myItems.map((i) => i.name),
			shouldSee: otherItems.map((i) => i.name),
			shouldNotSee: myItems.map((i) => i.name),
		};
	},
});

/**
 * Delete orphan user profiles (users not in the real user list).
 */
export const deleteOrphanUserProfiles = mutation({
	args: {},
	handler: async (ctx) => {
		const users = await ctx.db.query("users").collect();
		let deleted = 0;

		for (const user of users) {
			if (user.clerkId !== USER_A && user.clerkId !== USER_B) {
				await ctx.db.delete(user._id);
				deleted++;
			}
		}

		return { deleted, kept: users.length - deleted };
	},
});

/**
 * Diagnostic: Show all user IDs currently in the database.
 * Run this to see if there are any dummy users.
 */
export const diagnoseUsers = query({
	args: {},
	handler: async (ctx) => {
		const items = await ctx.db.query("items").collect();
		const claims = await ctx.db.query("claims").collect();
		const ratings = await ctx.db.query("ratings").collect();
		const users = await ctx.db.query("users").collect();

		// Collect all unique user IDs
		const allUserIds = new Set<string>();

		for (const item of items) {
			allUserIds.add(item.ownerId);
		}
		for (const claim of claims) {
			allUserIds.add(claim.claimerId);
		}
		for (const rating of ratings) {
			allUserIds.add(rating.fromUserId);
			allUserIds.add(rating.toUserId);
		}

		const userIdArray = Array.from(allUserIds);

		return {
			realUsers: { USER_A, USER_B },
			foundUserIds: userIdArray,
			isClean: userIdArray.every((id) => id === USER_A || id === USER_B),
			details: {
				items: items.map((i) => ({
					name: i.name,
					ownerId: i.ownerId,
					isRealUser: i.ownerId === USER_A || i.ownerId === USER_B,
					owner:
						i.ownerId === USER_A
							? "User A"
							: i.ownerId === USER_B
								? "User B"
								: "DUMMY",
				})),
				claims: claims.map((c) => {
					const item = items.find((i) => i._id === c.itemId);
					return {
						itemName: item?.name ?? "Unknown",
						itemOwner:
							item?.ownerId === USER_A
								? "User A"
								: item?.ownerId === USER_B
									? "User B"
									: "DUMMY",
						claimerId: c.claimerId,
						claimer:
							c.claimerId === USER_A
								? "User A"
								: c.claimerId === USER_B
									? "User B"
									: "DUMMY",
						status: c.status,
					};
				}),
				userProfiles: users.map((u) => ({
					clerkId: u.clerkId,
					isRealUser: u.clerkId === USER_A || u.clerkId === USER_B,
				})),
			},
		};
	},
});

/**
 * NUCLEAR RESET: Delete EVERYTHING and rebuild with only real users.
 * This is the definitive fix for dummy user data.
 */
export const nuclearReset = mutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();
		const deleted = {
			items: 0,
			claims: 0,
			itemActivity: 0,
			leaseActivity: 0,
			notifications: 0,
			availabilityAlerts: 0,
			ownerUnavailability: 0,
			wishlist: 0,
			users: 0,
			ratings: 0,
		};

		// DELETE EVERYTHING
		const items = await ctx.db.query("items").collect();
		for (const i of items) {
			await ctx.db.delete(i._id);
			deleted.items++;
		}

		const claims = await ctx.db.query("claims").collect();
		for (const c of claims) {
			await ctx.db.delete(c._id);
			deleted.claims++;
		}

		const itemActivity = await ctx.db.query("item_activity").collect();
		for (const a of itemActivity) {
			await ctx.db.delete(a._id);
			deleted.itemActivity++;
		}

		const leaseActivity = await ctx.db.query("lease_activity").collect();
		for (const a of leaseActivity) {
			await ctx.db.delete(a._id);
			deleted.leaseActivity++;
		}

		const notifications = await ctx.db.query("notifications").collect();
		for (const n of notifications) {
			await ctx.db.delete(n._id);
			deleted.notifications++;
		}

		const alerts = await ctx.db.query("availability_alerts").collect();
		for (const a of alerts) {
			await ctx.db.delete(a._id);
			deleted.availabilityAlerts++;
		}

		const unavail = await ctx.db.query("owner_unavailability").collect();
		for (const u of unavail) {
			await ctx.db.delete(u._id);
			deleted.ownerUnavailability++;
		}

		const wishlist = await ctx.db.query("wishlist").collect();
		for (const w of wishlist) {
			await ctx.db.delete(w._id);
			deleted.wishlist++;
		}

		const users = await ctx.db.query("users").collect();
		for (const u of users) {
			await ctx.db.delete(u._id);
			deleted.users++;
		}

		const ratings = await ctx.db.query("ratings").collect();
		for (const r of ratings) {
			await ctx.db.delete(r._id);
			deleted.ratings++;
		}

		// CREATE FRESH DATA FOR REAL USERS ONLY

		// Da Lat locations:
		// User A area: near Xuan Huong Lake (center of Da Lat)
		const USER_A_BASE = { lat: 11.9404, lng: 108.438 };
		// User B area: near Da Lat Market (slightly east)
		const USER_B_BASE = { lat: 11.942, lng: 108.455 };

		// Small random offset to avoid exact same location
		const offset = () => (Math.random() - 0.5) * 0.003; // ~150m radius

		// Items for User A (near Xuan Huong Lake area)
		const userAItems = [
			{
				name: "Playing Cards",
				description: "Classic deck of cards, great for game nights",
				category: "other" as const,
				location: {
					lat: USER_A_BASE.lat + offset(),
					lng: USER_A_BASE.lng + offset(),
					address: "Near Xuan Huong Lake, Da Lat",
				},
			},
			{
				name: "Camping Tent",
				description: "2-person lightweight tent, waterproof",
				category: "sports" as const,
				location: {
					lat: USER_A_BASE.lat + offset(),
					lng: USER_A_BASE.lng + offset(),
					address: "Near Xuan Huong Lake, Da Lat",
				},
			},
			{
				name: "Electric Drill",
				description: "Bosch cordless drill with battery pack",
				category: "other" as const,
				location: {
					lat: USER_A_BASE.lat + offset(),
					lng: USER_A_BASE.lng + offset(),
					address: "Near Xuan Huong Lake, Da Lat",
				},
			},
			{
				name: "Instant Pot",
				description: "6-quart pressure cooker, barely used",
				category: "kitchen" as const,
				location: {
					lat: USER_A_BASE.lat + offset(),
					lng: USER_A_BASE.lng + offset(),
					address: "Near Xuan Huong Lake, Da Lat",
				},
			},
		];

		// Items for User B (near Da Lat Market area)
		const userBItems = [
			{
				name: "Mosquito Killer",
				description: "Electric mosquito trap, UV light",
				category: "electronics" as const,
				location: {
					lat: USER_B_BASE.lat + offset(),
					lng: USER_B_BASE.lng + offset(),
					address: "Near Da Lat Market",
				},
			},
			{
				name: "Mountain Bike",
				description: "Trek Marlin 5, good condition",
				category: "sports" as const,
				location: {
					lat: USER_B_BASE.lat + offset(),
					lng: USER_B_BASE.lng + offset(),
					address: "Near Da Lat Market",
				},
			},
			{
				name: "DSLR Camera",
				description: "Canon EOS 80D with 18-135mm lens",
				category: "electronics" as const,
				location: {
					lat: USER_B_BASE.lat + offset(),
					lng: USER_B_BASE.lng + offset(),
					address: "Near Da Lat Market",
				},
			},
			{
				name: "Stand Mixer",
				description: "KitchenAid 5-quart with attachments",
				category: "kitchen" as const,
				location: {
					lat: USER_B_BASE.lat + offset(),
					lng: USER_B_BASE.lng + offset(),
					address: "Near Da Lat Market",
				},
			},
		];

		const createdItemsA: string[] = [];
		const createdItemsB: string[] = [];

		// Create User A's items
		for (const item of userAItems) {
			const itemId = await ctx.db.insert("items", {
				name: item.name,
				description: item.description,
				ownerId: USER_A,
				category: item.category,
				location: item.location,
			});
			createdItemsA.push(itemId);
			await ctx.db.insert("item_activity", {
				itemId,
				type: "item_created",
				actorId: USER_A,
				createdAt: now - 30 * ONE_DAY_MS,
			});
		}

		// Create User B's items
		for (const item of userBItems) {
			const itemId = await ctx.db.insert("items", {
				name: item.name,
				description: item.description,
				ownerId: USER_B,
				category: item.category,
				location: item.location,
			});
			createdItemsB.push(itemId);
			await ctx.db.insert("item_activity", {
				itemId,
				type: "item_created",
				actorId: USER_B,
				createdAt: now - 30 * ONE_DAY_MS,
			});
		}

		// CREATE CLAIMS: User B borrows from User A
		const claimsCreated: string[] = [];
		const claimsBBorrowsFromA: string[] = []; // Store claim IDs for ratings
		const claimsABorrowsFromB: string[] = []; // Store claim IDs for ratings

		for (let i = 0; i < 3; i++) {
			const itemId = createdItemsA[i];
			const daysAgo = 7 + i * 5; // 7, 12, 17 days ago

			const claimId = await ctx.db.insert("claims", {
				itemId: itemId as Id<"items">,
				claimerId: USER_B,
				status: "approved",
				startDate: now - (daysAgo + 7) * ONE_DAY_MS,
				endDate: now - daysAgo * ONE_DAY_MS,
				requestedAt: now - (daysAgo + 10) * ONE_DAY_MS,
				approvedAt: now - (daysAgo + 8) * ONE_DAY_MS,
			});

			claimsBBorrowsFromA.push(claimId);

			await ctx.db.insert("lease_activity", {
				itemId: itemId as Id<"items">,
				claimId,
				type: "lease_requested",
				actorId: USER_B,
				createdAt: now - (daysAgo + 10) * ONE_DAY_MS,
			});
			await ctx.db.insert("lease_activity", {
				itemId: itemId as Id<"items">,
				claimId,
				type: "lease_approved",
				actorId: USER_A,
				createdAt: now - (daysAgo + 8) * ONE_DAY_MS,
			});

			claimsCreated.push(`${userAItems[i].name}: User B borrowed from User A`);
		}

		// CREATE CLAIMS: User A borrows from User B
		for (let i = 0; i < 3; i++) {
			const itemId = createdItemsB[i];
			const daysAgo = 5 + i * 4; // 5, 9, 13 days ago

			const claimId = await ctx.db.insert("claims", {
				itemId: itemId as Id<"items">,
				claimerId: USER_A,
				status: "approved",
				startDate: now - (daysAgo + 5) * ONE_DAY_MS,
				endDate: now - daysAgo * ONE_DAY_MS,
				requestedAt: now - (daysAgo + 8) * ONE_DAY_MS,
				approvedAt: now - (daysAgo + 6) * ONE_DAY_MS,
			});

			claimsABorrowsFromB.push(claimId);

			await ctx.db.insert("lease_activity", {
				itemId: itemId as Id<"items">,
				claimId,
				type: "lease_requested",
				actorId: USER_A,
				createdAt: now - (daysAgo + 8) * ONE_DAY_MS,
			});
			await ctx.db.insert("lease_activity", {
				itemId: itemId as Id<"items">,
				claimId,
				type: "lease_approved",
				actorId: USER_B,
				createdAt: now - (daysAgo + 6) * ONE_DAY_MS,
			});

			claimsCreated.push(`${userBItems[i].name}: User A borrowed from User B`);
		}

		// CREATE SAMPLE RATINGS
		const ratingsCreated: string[] = [];

		// Rating 1: User A rates User B as borrower (for first claim where B borrowed from A)
		await ctx.db.insert("ratings", {
			claimId: claimsBBorrowsFromA[0] as Id<"claims">,
			fromUserId: USER_A,
			toUserId: USER_B,
			role: "borrower",
			stars: 5,
			comment: "Great borrower! Returned the item in perfect condition.",
			createdAt: now - 5 * ONE_DAY_MS,
		});
		ratingsCreated.push("User A → User B (as borrower): 5 stars");

		// Rating 2: User B rates User A as lender (for first claim where B borrowed from A)
		await ctx.db.insert("ratings", {
			claimId: claimsBBorrowsFromA[0] as Id<"claims">,
			fromUserId: USER_B,
			toUserId: USER_A,
			role: "lender",
			stars: 4,
			comment: "Very helpful, item was exactly as described.",
			createdAt: now - 4 * ONE_DAY_MS,
		});
		ratingsCreated.push("User B → User A (as lender): 4 stars");

		// Rating 3: User B rates User A as borrower (for first claim where A borrowed from B)
		await ctx.db.insert("ratings", {
			claimId: claimsABorrowsFromB[0] as Id<"claims">,
			fromUserId: USER_B,
			toUserId: USER_A,
			role: "borrower",
			stars: 5,
			comment: "Excellent borrower, very communicative!",
			createdAt: now - 3 * ONE_DAY_MS,
		});
		ratingsCreated.push("User B → User A (as borrower): 5 stars");

		// Rating 4: User A rates User B as lender (for first claim where A borrowed from B)
		await ctx.db.insert("ratings", {
			claimId: claimsABorrowsFromB[0] as Id<"claims">,
			fromUserId: USER_A,
			toUserId: USER_B,
			role: "lender",
			stars: 5,
			comment: "Fantastic lender, very flexible with pickup times.",
			createdAt: now - 2 * ONE_DAY_MS,
		});
		ratingsCreated.push("User A → User B (as lender): 5 stars");

		return {
			success: true,
			deleted,
			created: {
				userAItems: userAItems.map((i) => i.name),
				userBItems: userBItems.map((i) => i.name),
				claims: claimsCreated,
				ratings: ratingsCreated,
			},
			realUsers: {
				userA: USER_A,
				userB: USER_B,
			},
			howToTest: [
				"Login as User A → see ratings on profile, can rate User B for remaining claims",
				"Login as User B → see ratings on profile, can rate User A for remaining claims",
			],
		};
	},
});

/**
 * Force update ALL claims to have past dates (regardless of current dates).
 */
export const forceAllClaimsPast = mutation({
	args: {},
	handler: async (ctx) => {
		const claims = await ctx.db.query("claims").collect();

		const now = Date.now();
		let updated = 0;

		for (const claim of claims) {
			await ctx.db.patch(claim._id, {
				status: "approved",
				startDate: now - 7 * ONE_DAY_MS, // Started 7 days ago
				endDate: now - 1 * ONE_DAY_MS, // Ended yesterday
				approvedAt: claim.approvedAt ?? now - 8 * ONE_DAY_MS,
			});
			updated++;
		}

		return { updated };
	},
});

/**
 * View current database state for debugging.
 */
export const viewTestData = query({
	args: {},
	handler: async (ctx) => {
		const items = await ctx.db.query("items").collect();
		const claims = await ctx.db.query("claims").collect();
		const ratings = await ctx.db.query("ratings").collect();

		// Group items by owner
		const itemsByOwner = new Map<string, typeof items>();
		for (const item of items) {
			const ownerItems = itemsByOwner.get(item.ownerId) ?? [];
			ownerItems.push(item);
			itemsByOwner.set(item.ownerId, ownerItems);
		}

		// Format claims with item info
		const claimsWithInfo = claims.map((claim) => {
			const item = items.find((i) => i._id === claim.itemId);
			return {
				claimId: claim._id,
				itemName: item?.name ?? "Unknown",
				itemOwner: item?.ownerId ?? "Unknown",
				claimer: claim.claimerId,
				status: claim.status,
				startDate: new Date(claim.startDate).toISOString(),
				endDate: new Date(claim.endDate).toISOString(),
				canRate: claim.status === "approved" && claim.startDate < Date.now(),
			};
		});

		return {
			users: Array.from(itemsByOwner.keys()),
			itemCount: items.length,
			claimCount: claims.length,
			ratingCount: ratings.length,
			claims: claimsWithInfo,
		};
	},
});

/**
 * Setup complete test data for rating system.
 * Creates cross-claims so both users can rate each other in both roles.
 */
export const setupRatingTestData = mutation({
	args: {},
	handler: async (ctx) => {
		const items = await ctx.db.query("items").collect();

		// Get unique owners
		const ownerIds = Array.from(new Set(items.map((i) => i.ownerId)));

		if (ownerIds.length < 2) {
			return {
				error:
					"Need at least 2 users with items. Log in with both Google accounts and create an item from each.",
				users: ownerIds,
			};
		}

		const [userA, userB] = ownerIds;
		const itemsOfA = items.filter((i) => i.ownerId === userA);
		const itemsOfB = items.filter((i) => i.ownerId === userB);

		if (itemsOfA.length === 0 || itemsOfB.length === 0) {
			return {
				error: "Each user needs at least one item.",
				userA: { id: userA, itemCount: itemsOfA.length },
				userB: { id: userB, itemCount: itemsOfB.length },
			};
		}

		const now = Date.now();
		const results = {
			created: [] as string[],
			skipped: [] as string[],
		};

		// Scenario 1: User B borrows from User A
		// (User A can rate B as borrower, User B can rate A as lender)
		for (const item of itemsOfA) {
			const existing = await ctx.db
				.query("claims")
				.withIndex("by_item", (q) => q.eq("itemId", item._id))
				.filter((q) => q.eq(q.field("claimerId"), userB))
				.first();

			if (existing) {
				// Update to ensure it's ratable
				await ctx.db.patch(existing._id, {
					status: "approved",
					startDate: now - 14 * ONE_DAY_MS,
					endDate: now - 7 * ONE_DAY_MS,
					approvedAt: now - 15 * ONE_DAY_MS,
				});
				results.skipped.push(`${item.name} (updated existing)`);
			} else {
				await ctx.db.insert("claims", {
					itemId: item._id,
					claimerId: userB,
					status: "approved",
					startDate: now - 14 * ONE_DAY_MS,
					endDate: now - 7 * ONE_DAY_MS,
					requestedAt: now - 16 * ONE_DAY_MS,
					approvedAt: now - 15 * ONE_DAY_MS,
				});
				results.created.push(`${item.name} (B borrows from A)`);
			}
		}

		// Scenario 2: User A borrows from User B
		// (User B can rate A as borrower, User A can rate B as lender)
		for (const item of itemsOfB) {
			const existing = await ctx.db
				.query("claims")
				.withIndex("by_item", (q) => q.eq("itemId", item._id))
				.filter((q) => q.eq(q.field("claimerId"), userA))
				.first();

			if (existing) {
				await ctx.db.patch(existing._id, {
					status: "approved",
					startDate: now - 10 * ONE_DAY_MS,
					endDate: now - 3 * ONE_DAY_MS,
					approvedAt: now - 11 * ONE_DAY_MS,
				});
				results.skipped.push(`${item.name} (updated existing)`);
			} else {
				await ctx.db.insert("claims", {
					itemId: item._id,
					claimerId: userA,
					status: "approved",
					startDate: now - 10 * ONE_DAY_MS,
					endDate: now - 3 * ONE_DAY_MS,
					requestedAt: now - 12 * ONE_DAY_MS,
					approvedAt: now - 11 * ONE_DAY_MS,
				});
				results.created.push(`${item.name} (A borrows from B)`);
			}
		}

		return {
			success: true,
			userA,
			userB,
			...results,
			testScenarios: [
				`Login as User A: can rate User B as borrower (for lending items) AND as lender (for borrowing items)`,
				`Login as User B: can rate User A as borrower (for lending items) AND as lender (for borrowing items)`,
			],
		};
	},
});

/**
 * Clear all ratings (for re-testing).
 */
export const clearAllRatings = mutation({
	args: {},
	handler: async (ctx) => {
		const ratings = await ctx.db.query("ratings").collect();
		for (const rating of ratings) {
			await ctx.db.delete(rating._id);
		}
		return { deleted: ratings.length };
	},
});

/**
 * Setup claims between two specific real users for rating testing.
 * Hardcoded for your two Google accounts.
 */
export const setupClaimsForRealUsers = mutation({
	args: {},
	handler: async (ctx) => {
		// Your two Google accounts
		const userA = "user_38gb4lqLetM0bfE5ChI8DYn5ZLN"; // owns Playing Cards
		const userB = "user_38Wbynzhx7Pimx4nOA6bjYXiKzh"; // owns Mosquito killer

		const items = await ctx.db.query("items").collect();
		const now = Date.now();

		const results = {
			created: [] as string[],
			updated: [] as string[],
		};

		// Find items owned by each user
		const itemsOfUserA = items.filter((i) => i.ownerId === userA);
		const itemsOfUserB = items.filter((i) => i.ownerId === userB);

		// Create/update claims: User B borrows from User A
		for (const item of itemsOfUserA) {
			const existing = await ctx.db
				.query("claims")
				.withIndex("by_item", (q) => q.eq("itemId", item._id))
				.filter((q) => q.eq(q.field("claimerId"), userB))
				.first();

			if (existing) {
				await ctx.db.patch(existing._id, {
					status: "approved",
					startDate: now - 14 * ONE_DAY_MS,
					endDate: now - 7 * ONE_DAY_MS,
					approvedAt: now - 15 * ONE_DAY_MS,
				});
				results.updated.push(`${item.name}: UserB borrows from UserA`);
			} else {
				await ctx.db.insert("claims", {
					itemId: item._id,
					claimerId: userB,
					status: "approved",
					startDate: now - 14 * ONE_DAY_MS,
					endDate: now - 7 * ONE_DAY_MS,
					requestedAt: now - 16 * ONE_DAY_MS,
					approvedAt: now - 15 * ONE_DAY_MS,
				});
				results.created.push(`${item.name}: UserB borrows from UserA`);
			}
		}

		// Create/update claims: User A borrows from User B
		for (const item of itemsOfUserB) {
			const existing = await ctx.db
				.query("claims")
				.withIndex("by_item", (q) => q.eq("itemId", item._id))
				.filter((q) => q.eq(q.field("claimerId"), userA))
				.first();

			if (existing) {
				await ctx.db.patch(existing._id, {
					status: "approved",
					startDate: now - 10 * ONE_DAY_MS,
					endDate: now - 3 * ONE_DAY_MS,
					approvedAt: now - 11 * ONE_DAY_MS,
				});
				results.updated.push(`${item.name}: UserA borrows from UserB`);
			} else {
				await ctx.db.insert("claims", {
					itemId: item._id,
					claimerId: userA,
					status: "approved",
					startDate: now - 10 * ONE_DAY_MS,
					endDate: now - 3 * ONE_DAY_MS,
					requestedAt: now - 12 * ONE_DAY_MS,
					approvedAt: now - 11 * ONE_DAY_MS,
				});
				results.created.push(`${item.name}: UserA borrows from UserB`);
			}
		}

		return {
			success: true,
			userA: { id: userA, itemCount: itemsOfUserA.length },
			userB: { id: userB, itemCount: itemsOfUserB.length },
			...results,
			howToTest: [
				"Login as UserA (owns Playing Cards): Rate UserB as borrower + Rate UserB as lender",
				"Login as UserB (owns Mosquito killer): Rate UserA as borrower + Rate UserA as lender",
			],
		};
	},
});

/**
 * Update all approved claims to have dates in the past so ratings can be tested.
 * Run this from the Convex dashboard: npx convex dashboard → Functions → seed:makeClaimsRatable
 */
export const makeClaimsRatable = mutation({
	args: {},
	handler: async (ctx) => {
		const claims = await ctx.db
			.query("claims")
			.filter((q) => q.eq(q.field("status"), "approved"))
			.collect();

		const now = Date.now();
		let updated = 0;

		for (const claim of claims) {
			// Only update if startDate is in the future
			if (claim.startDate > now) {
				await ctx.db.patch(claim._id, {
					startDate: now - 7 * ONE_DAY_MS, // Started 7 days ago
					endDate: now - 1 * ONE_DAY_MS, // Ended yesterday
				});
				updated++;
			}
		}

		return { updated, total: claims.length };
	},
});

/**
 * Approve all pending claims and set dates to past for rating testing.
 */
export const approvePendingClaimsForTesting = mutation({
	args: {},
	handler: async (ctx) => {
		const claims = await ctx.db
			.query("claims")
			.filter((q) => q.eq(q.field("status"), "pending"))
			.collect();

		const now = Date.now();
		let updated = 0;

		for (const claim of claims) {
			await ctx.db.patch(claim._id, {
				status: "approved",
				approvedAt: now - 8 * ONE_DAY_MS,
				startDate: now - 7 * ONE_DAY_MS, // Started 7 days ago
				endDate: now - 1 * ONE_DAY_MS, // Ended yesterday
			});
			updated++;
		}

		return { approved: updated };
	},
});

/**
 * Create test claims between two users for rating testing.
 * You need to provide actual user IDs from Clerk.
 */
export const createTestClaims = mutation({
	args: {},
	handler: async (ctx) => {
		// Get all items
		const items = await ctx.db.query("items").collect();

		if (items.length === 0) {
			return { error: "No items found. Create some items first." };
		}

		// Get unique owner IDs
		const ownerIds = Array.from(new Set(items.map((i) => i.ownerId)));

		if (ownerIds.length < 2) {
			return {
				error:
					"Need at least 2 different users with items. Create items from different accounts.",
			};
		}

		const now = Date.now();
		let created = 0;

		// For each item, create a claim from a different user
		for (const item of items) {
			// Find another user to be the claimer
			const otherUserId = ownerIds.find((id) => id !== item.ownerId);
			if (!otherUserId) continue;

			// Check if a claim already exists
			const existingClaim = await ctx.db
				.query("claims")
				.withIndex("by_item", (q) => q.eq("itemId", item._id))
				.filter((q) => q.eq(q.field("claimerId"), otherUserId))
				.first();

			if (existingClaim) continue;

			// Create approved claim with past dates
			await ctx.db.insert("claims", {
				itemId: item._id,
				claimerId: otherUserId,
				status: "approved",
				startDate: now - 7 * ONE_DAY_MS,
				endDate: now - 1 * ONE_DAY_MS,
				requestedAt: now - 10 * ONE_DAY_MS,
				approvedAt: now - 8 * ONE_DAY_MS,
			});

			created++;
		}

		return { created, itemsProcessed: items.length };
	},
});

// Real Google-authenticated user IDs
const REAL_USER_A = "user_38gb4lqLetM0bfE5ChI8DYn5ZLN";
const REAL_USER_B = "user_38Wbynzhx7Pimx4nOA6bjYXiKzh";
const REAL_USERS = [REAL_USER_A, REAL_USER_B];

/**
 * Clean database: delete all data NOT related to real Google-authenticated users.
 */
export const cleanDummyData = mutation({
	args: {},
	handler: async (ctx) => {
		const results = {
			deletedItems: 0,
			deletedClaims: 0,
			deletedItemActivity: 0,
			deletedLeaseActivity: 0,
			deletedNotifications: 0,
			deletedAvailabilityAlerts: 0,
			deletedOwnerUnavailability: 0,
			deletedWishlist: 0,
			deletedUsers: 0,
			deletedRatings: 0,
			keptItems: 0,
		};

		// 1. Get items owned by real users (to keep)
		const allItems = await ctx.db.query("items").collect();
		const realUserItems = allItems.filter((i) =>
			REAL_USERS.includes(i.ownerId),
		);
		const realUserItemIds = new Set(realUserItems.map((i) => i._id));
		results.keptItems = realUserItems.length;

		// 2. Delete items NOT owned by real users
		const itemsToDelete = allItems.filter(
			(i) => !REAL_USERS.includes(i.ownerId),
		);
		for (const item of itemsToDelete) {
			await ctx.db.delete(item._id);
			results.deletedItems++;
		}

		// 3. Delete claims not related to real users (neither claimer nor item owner)
		const allClaims = await ctx.db.query("claims").collect();
		for (const claim of allClaims) {
			const isRealClaimer = REAL_USERS.includes(claim.claimerId);
			const isRealItem = realUserItemIds.has(claim.itemId);
			if (!isRealClaimer || !isRealItem) {
				await ctx.db.delete(claim._id);
				results.deletedClaims++;
			}
		}

		// 4. Delete item_activity for deleted items
		const itemActivity = await ctx.db.query("item_activity").collect();
		for (const activity of itemActivity) {
			if (!realUserItemIds.has(activity.itemId)) {
				await ctx.db.delete(activity._id);
				results.deletedItemActivity++;
			}
		}

		// 5. Delete lease_activity for deleted items
		const leaseActivity = await ctx.db.query("lease_activity").collect();
		for (const activity of leaseActivity) {
			if (!realUserItemIds.has(activity.itemId)) {
				await ctx.db.delete(activity._id);
				results.deletedLeaseActivity++;
			}
		}

		// 6. Delete notifications for non-real users or deleted items
		const notifications = await ctx.db.query("notifications").collect();
		for (const notification of notifications) {
			const isRealRecipient = REAL_USERS.includes(notification.recipientId);
			const isRealItem = realUserItemIds.has(notification.itemId);
			if (!isRealRecipient || !isRealItem) {
				await ctx.db.delete(notification._id);
				results.deletedNotifications++;
			}
		}

		// 7. Delete availability_alerts for non-real users
		const alerts = await ctx.db.query("availability_alerts").collect();
		for (const alert of alerts) {
			if (!REAL_USERS.includes(alert.userId)) {
				await ctx.db.delete(alert._id);
				results.deletedAvailabilityAlerts++;
			}
		}

		// 8. Delete owner_unavailability for non-real users
		const unavailability = await ctx.db.query("owner_unavailability").collect();
		for (const record of unavailability) {
			if (!REAL_USERS.includes(record.ownerId)) {
				await ctx.db.delete(record._id);
				results.deletedOwnerUnavailability++;
			}
		}

		// 9. Delete wishlist items from non-real users
		const wishlist = await ctx.db.query("wishlist").collect();
		for (const item of wishlist) {
			if (!REAL_USERS.includes(item.userId)) {
				await ctx.db.delete(item._id);
				results.deletedWishlist++;
			}
		}

		// 10. Delete user profiles for non-real users
		const users = await ctx.db.query("users").collect();
		for (const user of users) {
			if (!REAL_USERS.includes(user.clerkId)) {
				await ctx.db.delete(user._id);
				results.deletedUsers++;
			}
		}

		// 11. Delete ratings not between real users
		const ratings = await ctx.db.query("ratings").collect();
		for (const rating of ratings) {
			const isRealFrom = REAL_USERS.includes(rating.fromUserId);
			const isRealTo = REAL_USERS.includes(rating.toUserId);
			if (!isRealFrom || !isRealTo) {
				await ctx.db.delete(rating._id);
				results.deletedRatings++;
			}
		}

		return results;
	},
});

/**
 * Add more items for real users to test rating functionality.
 * Creates items with variety of categories.
 */
export const seedItemsForRealUsers = mutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();

		// Items for User A
		const userAItems = [
			{
				name: "Camping Tent (2-person)",
				description: "Lightweight tent, great for weekend trips",
				category: "sports" as const,
			},
			{
				name: "Electric Drill",
				description: "Bosch cordless drill with battery pack",
				category: "other" as const,
			},
			{
				name: "Yoga Mat",
				description: "Extra thick, non-slip surface",
				category: "sports" as const,
			},
			{
				name: "Instant Pot",
				description: "6-quart pressure cooker, barely used",
				category: "kitchen" as const,
			},
			{
				name: "Board Game Collection",
				description: "Catan, Ticket to Ride, Pandemic",
				category: "other" as const,
			},
		];

		// Items for User B
		const userBItems = [
			{
				name: "Mountain Bike",
				description: "Trek Marlin 5, good condition",
				category: "sports" as const,
			},
			{
				name: "DSLR Camera",
				description: "Canon EOS 80D with 18-135mm lens",
				category: "electronics" as const,
			},
			{
				name: "Portable Projector",
				description: "Anker Nebula, 720p, great for movie nights",
				category: "electronics" as const,
			},
			{
				name: "Stand Mixer",
				description: "KitchenAid 5-quart, with attachments",
				category: "kitchen" as const,
			},
			{
				name: "Folding Table",
				description: "6ft folding table for events",
				category: "furniture" as const,
			},
		];

		const createdItems: string[] = [];

		// Create items for User A
		for (const item of userAItems) {
			const itemId = await ctx.db.insert("items", {
				name: item.name,
				description: item.description,
				ownerId: REAL_USER_A,
				category: item.category,
			});
			createdItems.push(`${item.name} (User A)`);

			// Create activity record
			await ctx.db.insert("item_activity", {
				itemId,
				type: "item_created",
				actorId: REAL_USER_A,
				createdAt: now,
			});
		}

		// Create items for User B
		for (const item of userBItems) {
			const itemId = await ctx.db.insert("items", {
				name: item.name,
				description: item.description,
				ownerId: REAL_USER_B,
				category: item.category,
			});
			createdItems.push(`${item.name} (User B)`);

			// Create activity record
			await ctx.db.insert("item_activity", {
				itemId,
				type: "item_created",
				actorId: REAL_USER_B,
				createdAt: now,
			});
		}

		return {
			success: true,
			createdItems,
			userA: REAL_USER_A,
			userB: REAL_USER_B,
		};
	},
});

/**
 * Create cross-claims between real users for rating testing.
 * Each user borrows some items from the other, with varied timing.
 */
export const seedClaimsForRating = mutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();
		const items = await ctx.db.query("items").collect();

		const userAItems = items.filter((i) => i.ownerId === REAL_USER_A);
		const userBItems = items.filter((i) => i.ownerId === REAL_USER_B);

		const results = {
			created: [] as string[],
			skipped: [] as string[],
		};

		// User B borrows from User A (creates various past claims)
		for (let i = 0; i < Math.min(userAItems.length, 3); i++) {
			const item = userAItems[i];
			const existing = await ctx.db
				.query("claims")
				.withIndex("by_item", (q) => q.eq("itemId", item._id))
				.filter((q) => q.eq(q.field("claimerId"), REAL_USER_B))
				.first();

			if (existing) {
				results.skipped.push(item.name);
				continue;
			}

			// Vary the dates so we have different "transaction ages"
			const daysAgo = 7 + i * 5; // 7, 12, 17 days ago
			const claimId = await ctx.db.insert("claims", {
				itemId: item._id,
				claimerId: REAL_USER_B,
				status: "approved",
				startDate: now - (daysAgo + 7) * ONE_DAY_MS,
				endDate: now - daysAgo * ONE_DAY_MS,
				requestedAt: now - (daysAgo + 10) * ONE_DAY_MS,
				approvedAt: now - (daysAgo + 8) * ONE_DAY_MS,
			});

			// Create lease activity
			await ctx.db.insert("lease_activity", {
				itemId: item._id,
				claimId,
				type: "lease_requested",
				actorId: REAL_USER_B,
				createdAt: now - (daysAgo + 10) * ONE_DAY_MS,
			});
			await ctx.db.insert("lease_activity", {
				itemId: item._id,
				claimId,
				type: "lease_approved",
				actorId: REAL_USER_A,
				createdAt: now - (daysAgo + 8) * ONE_DAY_MS,
			});

			results.created.push(`${item.name} (B borrows from A)`);
		}

		// User A borrows from User B
		for (let i = 0; i < Math.min(userBItems.length, 3); i++) {
			const item = userBItems[i];
			const existing = await ctx.db
				.query("claims")
				.withIndex("by_item", (q) => q.eq("itemId", item._id))
				.filter((q) => q.eq(q.field("claimerId"), REAL_USER_A))
				.first();

			if (existing) {
				results.skipped.push(item.name);
				continue;
			}

			const daysAgo = 5 + i * 4; // 5, 9, 13 days ago
			const claimId = await ctx.db.insert("claims", {
				itemId: item._id,
				claimerId: REAL_USER_A,
				status: "approved",
				startDate: now - (daysAgo + 5) * ONE_DAY_MS,
				endDate: now - daysAgo * ONE_DAY_MS,
				requestedAt: now - (daysAgo + 8) * ONE_DAY_MS,
				approvedAt: now - (daysAgo + 6) * ONE_DAY_MS,
			});

			// Create lease activity
			await ctx.db.insert("lease_activity", {
				itemId: item._id,
				claimId,
				type: "lease_requested",
				actorId: REAL_USER_A,
				createdAt: now - (daysAgo + 8) * ONE_DAY_MS,
			});
			await ctx.db.insert("lease_activity", {
				itemId: item._id,
				claimId,
				type: "lease_approved",
				actorId: REAL_USER_B,
				createdAt: now - (daysAgo + 6) * ONE_DAY_MS,
			});

			results.created.push(`${item.name} (A borrows from B)`);
		}

		return {
			success: true,
			userAItemCount: userAItems.length,
			userBItemCount: userBItems.length,
			...results,
			testInstructions: [
				"Login as User A: can rate User B as borrower + lender",
				"Login as User B: can rate User A as borrower + lender",
			],
		};
	},
});

/**
 * Full reset and seed: clean dummy data, add items, create claims.
 * Run this single mutation to prepare database for rating testing.
 */
export const fullResetAndSeed = mutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();

		// ===== STEP 1: Clean all non-real-user data =====
		const cleanResults = {
			deletedItems: 0,
			deletedClaims: 0,
			deletedItemActivity: 0,
			deletedLeaseActivity: 0,
			deletedNotifications: 0,
			deletedRatings: 0,
		};

		// Get items owned by real users
		const allItems = await ctx.db.query("items").collect();
		const realUserItemIds = new Set(
			allItems.filter((i) => REAL_USERS.includes(i.ownerId)).map((i) => i._id),
		);

		// Delete non-real-user items
		for (const item of allItems) {
			if (!REAL_USERS.includes(item.ownerId)) {
				await ctx.db.delete(item._id);
				cleanResults.deletedItems++;
			}
		}

		// Delete orphaned claims
		const allClaims = await ctx.db.query("claims").collect();
		for (const claim of allClaims) {
			if (
				!realUserItemIds.has(claim.itemId) ||
				!REAL_USERS.includes(claim.claimerId)
			) {
				await ctx.db.delete(claim._id);
				cleanResults.deletedClaims++;
			}
		}

		// Delete orphaned activities
		const itemActivity = await ctx.db.query("item_activity").collect();
		for (const a of itemActivity) {
			if (!realUserItemIds.has(a.itemId)) {
				await ctx.db.delete(a._id);
				cleanResults.deletedItemActivity++;
			}
		}

		const leaseActivity = await ctx.db.query("lease_activity").collect();
		for (const a of leaseActivity) {
			if (!realUserItemIds.has(a.itemId)) {
				await ctx.db.delete(a._id);
				cleanResults.deletedLeaseActivity++;
			}
		}

		// Delete orphaned notifications
		const notifications = await ctx.db.query("notifications").collect();
		for (const n of notifications) {
			if (
				!REAL_USERS.includes(n.recipientId) ||
				!realUserItemIds.has(n.itemId)
			) {
				await ctx.db.delete(n._id);
				cleanResults.deletedNotifications++;
			}
		}

		// Delete orphaned ratings
		const ratings = await ctx.db.query("ratings").collect();
		for (const r of ratings) {
			if (
				!REAL_USERS.includes(r.fromUserId) ||
				!REAL_USERS.includes(r.toUserId)
			) {
				await ctx.db.delete(r._id);
				cleanResults.deletedRatings++;
			}
		}

		// ===== STEP 2: Add new items =====
		const userANewItems = [
			{
				name: "Camping Tent (2-person)",
				description: "Lightweight tent, great for weekend trips",
				category: "sports" as const,
			},
			{
				name: "Electric Drill",
				description: "Bosch cordless drill with battery pack",
				category: "other" as const,
			},
			{
				name: "Yoga Mat",
				description: "Extra thick, non-slip surface",
				category: "sports" as const,
			},
			{
				name: "Instant Pot",
				description: "6-quart pressure cooker, barely used",
				category: "kitchen" as const,
			},
		];

		const userBNewItems = [
			{
				name: "Mountain Bike",
				description: "Trek Marlin 5, good condition",
				category: "sports" as const,
			},
			{
				name: "DSLR Camera",
				description: "Canon EOS 80D with 18-135mm lens",
				category: "electronics" as const,
			},
			{
				name: "Portable Projector",
				description: "Anker Nebula, 720p, great for movie nights",
				category: "electronics" as const,
			},
			{
				name: "Stand Mixer",
				description: "KitchenAid 5-quart, with attachments",
				category: "kitchen" as const,
			},
		];

		const createdItemIds: { userA: string[]; userB: string[] } = {
			userA: [],
			userB: [],
		};

		for (const item of userANewItems) {
			const itemId = await ctx.db.insert("items", {
				name: item.name,
				description: item.description,
				ownerId: REAL_USER_A,
				category: item.category,
			});
			createdItemIds.userA.push(itemId);
			await ctx.db.insert("item_activity", {
				itemId,
				type: "item_created",
				actorId: REAL_USER_A,
				createdAt: now,
			});
		}

		for (const item of userBNewItems) {
			const itemId = await ctx.db.insert("items", {
				name: item.name,
				description: item.description,
				ownerId: REAL_USER_B,
				category: item.category,
			});
			createdItemIds.userB.push(itemId);
			await ctx.db.insert("item_activity", {
				itemId,
				type: "item_created",
				actorId: REAL_USER_B,
				createdAt: now,
			});
		}

		// ===== STEP 3: Create claims for rating testing =====
		const allItemsAfterSeed = await ctx.db.query("items").collect();
		const userAItemsForClaims = allItemsAfterSeed.filter(
			(i) => i.ownerId === REAL_USER_A,
		);
		const userBItemsForClaims = allItemsAfterSeed.filter(
			(i) => i.ownerId === REAL_USER_B,
		);

		const claimsCreated: string[] = [];

		// User B borrows 3 items from User A
		for (let i = 0; i < Math.min(userAItemsForClaims.length, 3); i++) {
			const item = userAItemsForClaims[i];
			const existing = await ctx.db
				.query("claims")
				.withIndex("by_item", (q) => q.eq("itemId", item._id))
				.filter((q) => q.eq(q.field("claimerId"), REAL_USER_B))
				.first();
			if (existing) continue;

			const daysAgo = 7 + i * 5;
			const claimId = await ctx.db.insert("claims", {
				itemId: item._id,
				claimerId: REAL_USER_B,
				status: "approved",
				startDate: now - (daysAgo + 7) * ONE_DAY_MS,
				endDate: now - daysAgo * ONE_DAY_MS,
				requestedAt: now - (daysAgo + 10) * ONE_DAY_MS,
				approvedAt: now - (daysAgo + 8) * ONE_DAY_MS,
			});

			await ctx.db.insert("lease_activity", {
				itemId: item._id,
				claimId,
				type: "lease_requested",
				actorId: REAL_USER_B,
				createdAt: now - (daysAgo + 10) * ONE_DAY_MS,
			});
			await ctx.db.insert("lease_activity", {
				itemId: item._id,
				claimId,
				type: "lease_approved",
				actorId: REAL_USER_A,
				createdAt: now - (daysAgo + 8) * ONE_DAY_MS,
			});

			claimsCreated.push(`${item.name} (B←A)`);
		}

		// User A borrows 3 items from User B
		for (let i = 0; i < Math.min(userBItemsForClaims.length, 3); i++) {
			const item = userBItemsForClaims[i];
			const existing = await ctx.db
				.query("claims")
				.withIndex("by_item", (q) => q.eq("itemId", item._id))
				.filter((q) => q.eq(q.field("claimerId"), REAL_USER_A))
				.first();
			if (existing) continue;

			const daysAgo = 5 + i * 4;
			const claimId = await ctx.db.insert("claims", {
				itemId: item._id,
				claimerId: REAL_USER_A,
				status: "approved",
				startDate: now - (daysAgo + 5) * ONE_DAY_MS,
				endDate: now - daysAgo * ONE_DAY_MS,
				requestedAt: now - (daysAgo + 8) * ONE_DAY_MS,
				approvedAt: now - (daysAgo + 6) * ONE_DAY_MS,
			});

			await ctx.db.insert("lease_activity", {
				itemId: item._id,
				claimId,
				type: "lease_requested",
				actorId: REAL_USER_A,
				createdAt: now - (daysAgo + 8) * ONE_DAY_MS,
			});
			await ctx.db.insert("lease_activity", {
				itemId: item._id,
				claimId,
				type: "lease_approved",
				actorId: REAL_USER_B,
				createdAt: now - (daysAgo + 6) * ONE_DAY_MS,
			});

			claimsCreated.push(`${item.name} (A←B)`);
		}

		return {
			success: true,
			cleaned: cleanResults,
			itemsCreated: {
				userA: userANewItems.map((i) => i.name),
				userB: userBNewItems.map((i) => i.name),
			},
			claimsCreated,
			realUsers: {
				userA: REAL_USER_A,
				userB: REAL_USER_B,
			},
			howToTest: [
				"Login as User A: rate User B as borrower (for your items) + as lender (for borrowed items)",
				"Login as User B: rate User A as borrower (for your items) + as lender (for borrowed items)",
			],
		};
	},
});

/**
 * Update item images with Cloudinary URLs.
 * Run after uploading images via scripts/upload-stock-images.ts
 *
 * Usage: npx convex run seed:updateItemImages '{"images": [{"itemName": "...", "publicId": "...", "secureUrl": "..."}]}'
 */
export const updateItemImages = mutation({
	args: {
		images: v.array(
			v.object({
				itemName: v.string(),
				publicId: v.string(),
				secureUrl: v.string(),
			}),
		),
	},
	handler: async (ctx, args) => {
		const results: { itemName: string; updated: boolean; error?: string }[] =
			[];

		for (const img of args.images) {
			const item = await ctx.db
				.query("items")
				.filter((q) => q.eq(q.field("name"), img.itemName))
				.first();

			if (!item) {
				results.push({
					itemName: img.itemName,
					updated: false,
					error: "Item not found",
				});
				continue;
			}

			await ctx.db.patch(item._id, {
				imageCloudinary: [{ publicId: img.publicId, secureUrl: img.secureUrl }],
			});
			results.push({ itemName: img.itemName, updated: true });
		}

		return results;
	},
});

/**
 * COMPREHENSIVE TEST DATA SETUP for Features 1, 2, 3
 *
 * Creates test data for:
 * - Feature #1 (Time slots): Approved claim with FUTURE startDate, no pickedUpAt yet
 * - Feature #2 (Contact details): Pending claim to approve (generates notification)
 * - Feature #3 (Borrowed items): Claims with pickedUpAt set and various due dates
 *
 * Run with: npx convex run seed:setupFeatureTestData '{}'
 */
export const setupFeatureTestData = mutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();
		const results = {
			feature1: { created: false, itemName: "", claimId: "" },
			feature2: { created: false, itemName: "", claimId: "" },
			feature3: [] as { itemName: string; dueIn: string; claimId: string }[],
		};

		// Get existing items
		const items = await ctx.db.query("items").collect();
		const itemsFromA = items.filter((i) => i.ownerId === USER_A);
		const itemsFromB = items.filter((i) => i.ownerId === USER_B);

		if (itemsFromA.length < 4 || itemsFromB.length < 2) {
			return {
				error:
					"Not enough items. Need at least 4 items from USER_A and 2 from USER_B",
				itemsFromA: itemsFromA.length,
				itemsFromB: itemsFromB.length,
			};
		}

		// ===== FEATURE #1: Time slots (approved, future dates, NO pickedUpAt) =====
		// USER_B wants to borrow from USER_A, needs to propose pickup time
		const feature1Item = itemsFromA[0];
		const existingF1Claim = await ctx.db
			.query("claims")
			.withIndex("by_item", (q) => q.eq("itemId", feature1Item._id))
			.filter((q) =>
				q.and(
					q.eq(q.field("claimerId"), USER_B),
					q.eq(q.field("status"), "approved"),
				),
			)
			.first();

		if (existingF1Claim && !existingF1Claim.pickedUpAt) {
			// Update existing claim to have future dates
			await ctx.db.patch(existingF1Claim._id, {
				startDate: now + 1 * ONE_DAY_MS, // Tomorrow
				endDate: now + 8 * ONE_DAY_MS, // 8 days from now
			});
			results.feature1 = {
				created: false,
				itemName: feature1Item.name,
				claimId: existingF1Claim._id,
			};
		} else if (!existingF1Claim) {
			const claimId = await ctx.db.insert("claims", {
				itemId: feature1Item._id,
				claimerId: USER_B,
				status: "approved",
				startDate: now + 1 * ONE_DAY_MS, // Tomorrow (FUTURE!)
				endDate: now + 8 * ONE_DAY_MS,
				requestedAt: now - 1 * ONE_DAY_MS,
				approvedAt: now,
				// NO pickedUpAt - borrower needs to propose time!
			});
			await ctx.db.insert("lease_activity", {
				itemId: feature1Item._id,
				claimId,
				type: "lease_approved",
				actorId: USER_A,
				createdAt: now,
			});
			results.feature1 = {
				created: true,
				itemName: feature1Item.name,
				claimId,
			};
		}

		// ===== FEATURE #2: Contact details notification (pending -> approve) =====
		// Create a pending claim that USER_A can approve
		const feature2Item = itemsFromA[1];
		const existingF2Claim = await ctx.db
			.query("claims")
			.withIndex("by_item", (q) => q.eq("itemId", feature2Item._id))
			.filter((q) =>
				q.and(
					q.eq(q.field("claimerId"), USER_B),
					q.eq(q.field("status"), "pending"),
				),
			)
			.first();

		if (!existingF2Claim) {
			const claimId = await ctx.db.insert("claims", {
				itemId: feature2Item._id,
				claimerId: USER_B,
				status: "pending",
				startDate: now + 2 * ONE_DAY_MS,
				endDate: now + 9 * ONE_DAY_MS,
				requestedAt: now,
			});
			await ctx.db.insert("lease_activity", {
				itemId: feature2Item._id,
				claimId,
				type: "lease_requested",
				actorId: USER_B,
				createdAt: now,
			});
			// Create notification for owner
			await ctx.db.insert("notifications", {
				recipientId: USER_A,
				type: "new_request",
				itemId: feature2Item._id,
				requestId: claimId,
				isRead: false,
				createdAt: now,
			});
			results.feature2 = {
				created: true,
				itemName: feature2Item.name,
				claimId,
			};
		} else {
			results.feature2 = {
				created: false,
				itemName: feature2Item.name,
				claimId: existingF2Claim._id,
			};
		}

		// ===== FEATURE #3: Borrowed items with various due dates =====
		const dueConfigs = [
			{ daysUntilDue: 7, label: "7 days (green)" },
			{ daysUntilDue: 2, label: "2 days (amber)" },
			{ daysUntilDue: 0, label: "today (amber)" },
			{ daysUntilDue: -3, label: "overdue 3 days (red)" },
		];

		for (
			let i = 0;
			i < Math.min(dueConfigs.length, itemsFromA.length - 2);
			i++
		) {
			const config = dueConfigs[i];
			const item = itemsFromA[i + 2]; // Skip first 2 items used for F1/F2

			// Check for existing borrowed claim
			const existingClaim = await ctx.db
				.query("claims")
				.withIndex("by_item", (q) => q.eq("itemId", item._id))
				.filter((q) =>
					q.and(
						q.eq(q.field("claimerId"), USER_B),
						q.eq(q.field("status"), "approved"),
						q.neq(q.field("pickedUpAt"), undefined),
					),
				)
				.first();

			if (existingClaim) {
				// Update endDate to match config
				const newEndDate = now + config.daysUntilDue * ONE_DAY_MS;
				await ctx.db.patch(existingClaim._id, { endDate: newEndDate });
				results.feature3.push({
					itemName: item.name,
					dueIn: config.label,
					claimId: existingClaim._id,
				});
			} else {
				const claimId = await ctx.db.insert("claims", {
					itemId: item._id,
					claimerId: USER_B,
					status: "approved",
					startDate: now - 5 * ONE_DAY_MS, // Started 5 days ago
					endDate: now + config.daysUntilDue * ONE_DAY_MS,
					requestedAt: now - 7 * ONE_DAY_MS,
					approvedAt: now - 6 * ONE_DAY_MS,
					pickedUpAt: now - 5 * ONE_DAY_MS, // Already picked up!
				});
				await ctx.db.insert("lease_activity", {
					itemId: item._id,
					claimId,
					type: "lease_picked_up",
					actorId: USER_A,
					createdAt: now - 5 * ONE_DAY_MS,
				});
				results.feature3.push({
					itemName: item.name,
					dueIn: config.label,
					claimId,
				});
			}
		}

		return {
			success: true,
			results,
			howToTest: {
				feature1:
					"Login as USER_B → Go to item detail → Click 'Propose Pickup Time' → Select future time",
				feature2:
					"Login as USER_A → Go to notifications → Approve the pending request → USER_B gets notification with 'View Profile'",
				feature3:
					"Login as USER_B → Go to 'My Items' tab → See 'Items I'm Borrowing' section with different due badges",
			},
		};
	},
});

/**
 * Setup a borrowed item for testing the "Items I'm Borrowing" section.
 * Creates an approved claim with pickedUpAt set, so it shows as actively borrowed.
 * Use futureDays parameter to set how many days until due date.
 */
export const setupBorrowedItemForTesting = mutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();

		// Find an item owned by USER_A that USER_B can borrow
		const items = await ctx.db.query("items").collect();
		const itemFromA = items.find((i) => i.ownerId === USER_A);

		if (!itemFromA) {
			return { error: "No items found owned by USER_A" };
		}

		// Check for existing borrowed claim on this item
		const existingClaim = await ctx.db
			.query("claims")
			.withIndex("by_item", (q) => q.eq("itemId", itemFromA._id))
			.filter((q) =>
				q.and(
					q.eq(q.field("claimerId"), USER_B),
					q.eq(q.field("status"), "approved"),
					q.neq(q.field("pickedUpAt"), undefined),
				),
			)
			.first();

		if (existingClaim && !existingClaim.returnedAt) {
			return {
				alreadyExists: true,
				claimId: existingClaim._id,
				itemName: itemFromA.name,
				message: "Borrowed item already exists for testing",
			};
		}

		// Create new claim with FUTURE dates
		const startDate = now; // Today
		const endDate = now + 5 * ONE_DAY_MS; // 5 days from now

		const claimId = await ctx.db.insert("claims", {
			itemId: itemFromA._id,
			claimerId: USER_B,
			status: "approved",
			startDate,
			endDate,
			requestedAt: now - 2 * ONE_DAY_MS,
			approvedAt: now - 1 * ONE_DAY_MS,
			pickedUpAt: now, // Already picked up!
		});

		// Add lease activity for pickup
		await ctx.db.insert("lease_activity", {
			itemId: itemFromA._id,
			claimId,
			type: "lease_picked_up",
			actorId: USER_A,
			createdAt: now,
		});

		return {
			success: true,
			claimId,
			itemId: itemFromA._id,
			itemName: itemFromA.name,
			borrower: USER_B,
			owner: USER_A,
			startDate: new Date(startDate).toISOString(),
			endDate: new Date(endDate).toISOString(),
			message:
				"Login as USER_B to see this item in 'Items I'm Borrowing' section",
		};
	},
});

/**
 * Setup journey test scenarios: 11 items at different lifecycle stages.
 * Each item has a claim with the exact set of events to visualize that stage.
 * Idempotent: deletes all items with "[TEST] Journey:" prefix first.
 *
 * Run with: npx convex run seed:setupJourneyTestScenarios
 */
export const setupJourneyTestScenarios = mutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();
		const TWO_DAYS = 2 * ONE_DAY_MS;
		const ONE_HOUR = 60 * 60 * 1000;
		const TEST_PREFIX = "[TEST] Journey:";

		// ===== CLEANUP: delete existing test items, their claims and activities =====
		const allItems = await ctx.db.query("items").collect();
		const testItems = allItems.filter((i) => i.name.startsWith(TEST_PREFIX));
		const testItemIds = new Set(testItems.map((i) => i._id));

		for (const item of testItems) {
			// Delete claims for this item
			const claims = await ctx.db
				.query("claims")
				.withIndex("by_item", (q) => q.eq("itemId", item._id))
				.collect();
			for (const claim of claims) {
				// Delete lease_activity for this claim
				const activities = await ctx.db
					.query("lease_activity")
					.withIndex("by_claim_createdAt", (q) => q.eq("claimId", claim._id))
					.collect();
				for (const a of activities) {
					await ctx.db.delete(a._id);
				}
				await ctx.db.delete(claim._id);
			}
			// Delete item_activity for this item
			const itemActivities = await ctx.db
				.query("item_activity")
				.withIndex("by_item", (q) => q.eq("itemId", item._id))
				.collect();
			for (const a of itemActivities) {
				await ctx.db.delete(a._id);
			}
			await ctx.db.delete(item._id);
		}

		// ===== HELPER: create item + claim + events =====
		type EventDef = {
			type:
				| "lease_requested"
				| "lease_approved"
				| "lease_rejected"
				| "lease_expired"
				| "lease_missing"
				| "lease_pickup_proposed"
				| "lease_pickup_approved"
				| "lease_return_proposed"
				| "lease_return_approved"
				| "lease_picked_up"
				| "lease_returned"
				| "lease_transferred";
			actorId: string;
			createdAt: number;
			proposalId?: string;
			windowStartAt?: number;
			windowEndAt?: number;
		};

		type ScenarioDef = {
			name: string;
			claimStatus: "pending" | "approved" | "rejected";
			claimExtra: Record<string, number>;
			events: EventDef[];
		};

		// Base timestamp: all steps in the future to avoid cron auto-expiry.
		// step 0 = +1 day, step 9 = +19 days. Events use past-looking offsets
		// but actual timestamps are future so resolveOverdueProposals won't touch them.
		const t = (step: number) => now + (1 + step * 2) * ONE_DAY_MS;

		const pickupProposalId = crypto.randomUUID();
		const returnProposalId = crypto.randomUUID();

		const scenarios: ScenarioDef[] = [
			// 1. Requested
			{
				name: `${TEST_PREFIX} Requested`,
				claimStatus: "pending",
				claimExtra: { requestedAt: t(0) },
				events: [
					{
						type: "lease_requested",
						actorId: USER_B,
						createdAt: t(0),
					},
				],
			},
			// 2. Approved
			{
				name: `${TEST_PREFIX} Approved`,
				claimStatus: "approved",
				claimExtra: { requestedAt: t(0), approvedAt: t(1) },
				events: [
					{
						type: "lease_requested",
						actorId: USER_B,
						createdAt: t(0),
					},
					{
						type: "lease_approved",
						actorId: USER_A,
						createdAt: t(1),
					},
				],
			},
			// 3. Pickup Proposed
			{
				name: `${TEST_PREFIX} Pickup Proposed`,
				claimStatus: "approved",
				claimExtra: { requestedAt: t(0), approvedAt: t(1) },
				events: [
					{
						type: "lease_requested",
						actorId: USER_B,
						createdAt: t(0),
					},
					{
						type: "lease_approved",
						actorId: USER_A,
						createdAt: t(1),
					},
					{
						type: "lease_pickup_proposed",
						actorId: USER_B,
						createdAt: t(2),
						proposalId: pickupProposalId,
						windowStartAt: t(3),
						windowEndAt: t(3) + ONE_HOUR,
					},
				],
			},
			// 4. Pickup Confirmed
			{
				name: `${TEST_PREFIX} Pickup Confirmed`,
				claimStatus: "approved",
				claimExtra: { requestedAt: t(0), approvedAt: t(1) },
				events: [
					{
						type: "lease_requested",
						actorId: USER_B,
						createdAt: t(0),
					},
					{
						type: "lease_approved",
						actorId: USER_A,
						createdAt: t(1),
					},
					{
						type: "lease_pickup_proposed",
						actorId: USER_B,
						createdAt: t(2),
						proposalId: pickupProposalId,
						windowStartAt: t(3),
						windowEndAt: t(3) + ONE_HOUR,
					},
					{
						type: "lease_pickup_approved",
						actorId: USER_A,
						createdAt: t(3),
						proposalId: pickupProposalId,
						windowStartAt: t(3),
						windowEndAt: t(3) + ONE_HOUR,
					},
				],
			},
			// 5. Picked Up
			{
				name: `${TEST_PREFIX} Picked Up`,
				claimStatus: "approved",
				claimExtra: {
					requestedAt: t(0),
					approvedAt: t(1),
					pickedUpAt: t(4),
				},
				events: [
					{
						type: "lease_requested",
						actorId: USER_B,
						createdAt: t(0),
					},
					{
						type: "lease_approved",
						actorId: USER_A,
						createdAt: t(1),
					},
					{
						type: "lease_pickup_proposed",
						actorId: USER_B,
						createdAt: t(2),
						proposalId: pickupProposalId,
						windowStartAt: t(3),
						windowEndAt: t(3) + ONE_HOUR,
					},
					{
						type: "lease_pickup_approved",
						actorId: USER_A,
						createdAt: t(3),
						proposalId: pickupProposalId,
						windowStartAt: t(3),
						windowEndAt: t(3) + ONE_HOUR,
					},
					{
						type: "lease_picked_up",
						actorId: USER_B,
						createdAt: t(4),
					},
				],
			},
			// 6. Return Proposed
			{
				name: `${TEST_PREFIX} Return Proposed`,
				claimStatus: "approved",
				claimExtra: {
					requestedAt: t(0),
					approvedAt: t(1),
					pickedUpAt: t(4),
				},
				events: [
					{
						type: "lease_requested",
						actorId: USER_B,
						createdAt: t(0),
					},
					{
						type: "lease_approved",
						actorId: USER_A,
						createdAt: t(1),
					},
					{
						type: "lease_pickup_proposed",
						actorId: USER_B,
						createdAt: t(2),
						proposalId: pickupProposalId,
						windowStartAt: t(3),
						windowEndAt: t(3) + ONE_HOUR,
					},
					{
						type: "lease_pickup_approved",
						actorId: USER_A,
						createdAt: t(3),
						proposalId: pickupProposalId,
						windowStartAt: t(3),
						windowEndAt: t(3) + ONE_HOUR,
					},
					{
						type: "lease_picked_up",
						actorId: USER_B,
						createdAt: t(4),
					},
					{
						type: "lease_return_proposed",
						actorId: USER_B,
						createdAt: t(5),
						proposalId: returnProposalId,
						windowStartAt: t(6),
						windowEndAt: t(6) + ONE_HOUR,
					},
				],
			},
			// 7. Return Confirmed
			{
				name: `${TEST_PREFIX} Return Confirmed`,
				claimStatus: "approved",
				claimExtra: {
					requestedAt: t(0),
					approvedAt: t(1),
					pickedUpAt: t(4),
				},
				events: [
					{
						type: "lease_requested",
						actorId: USER_B,
						createdAt: t(0),
					},
					{
						type: "lease_approved",
						actorId: USER_A,
						createdAt: t(1),
					},
					{
						type: "lease_pickup_proposed",
						actorId: USER_B,
						createdAt: t(2),
						proposalId: pickupProposalId,
						windowStartAt: t(3),
						windowEndAt: t(3) + ONE_HOUR,
					},
					{
						type: "lease_pickup_approved",
						actorId: USER_A,
						createdAt: t(3),
						proposalId: pickupProposalId,
						windowStartAt: t(3),
						windowEndAt: t(3) + ONE_HOUR,
					},
					{
						type: "lease_picked_up",
						actorId: USER_B,
						createdAt: t(4),
					},
					{
						type: "lease_return_proposed",
						actorId: USER_B,
						createdAt: t(5),
						proposalId: returnProposalId,
						windowStartAt: t(6),
						windowEndAt: t(6) + ONE_HOUR,
					},
					{
						type: "lease_return_approved",
						actorId: USER_A,
						createdAt: t(6),
						proposalId: returnProposalId,
						windowStartAt: t(6),
						windowEndAt: t(6) + ONE_HOUR,
					},
				],
			},
			// 8. Returned
			{
				name: `${TEST_PREFIX} Returned`,
				claimStatus: "approved",
				claimExtra: {
					requestedAt: t(0),
					approvedAt: t(1),
					pickedUpAt: t(4),
					returnedAt: t(7),
				},
				events: [
					{
						type: "lease_requested",
						actorId: USER_B,
						createdAt: t(0),
					},
					{
						type: "lease_approved",
						actorId: USER_A,
						createdAt: t(1),
					},
					{
						type: "lease_pickup_proposed",
						actorId: USER_B,
						createdAt: t(2),
						proposalId: pickupProposalId,
						windowStartAt: t(3),
						windowEndAt: t(3) + ONE_HOUR,
					},
					{
						type: "lease_pickup_approved",
						actorId: USER_A,
						createdAt: t(3),
						proposalId: pickupProposalId,
						windowStartAt: t(3),
						windowEndAt: t(3) + ONE_HOUR,
					},
					{
						type: "lease_picked_up",
						actorId: USER_B,
						createdAt: t(4),
					},
					{
						type: "lease_return_proposed",
						actorId: USER_B,
						createdAt: t(5),
						proposalId: returnProposalId,
						windowStartAt: t(6),
						windowEndAt: t(6) + ONE_HOUR,
					},
					{
						type: "lease_return_approved",
						actorId: USER_A,
						createdAt: t(6),
						proposalId: returnProposalId,
						windowStartAt: t(6),
						windowEndAt: t(6) + ONE_HOUR,
					},
					{
						type: "lease_returned",
						actorId: USER_B,
						createdAt: t(7),
					},
				],
			},
			// 9. Rejected
			{
				name: `${TEST_PREFIX} Rejected`,
				claimStatus: "rejected",
				claimExtra: { requestedAt: t(0), rejectedAt: t(1) },
				events: [
					{
						type: "lease_requested",
						actorId: USER_B,
						createdAt: t(0),
					},
					{
						type: "lease_rejected",
						actorId: USER_A,
						createdAt: t(1),
					},
				],
			},
			// 10. Expired
			{
				name: `${TEST_PREFIX} Expired`,
				claimStatus: "approved",
				claimExtra: {
					requestedAt: t(0),
					approvedAt: t(1),
					expiredAt: t(2),
				},
				events: [
					{
						type: "lease_requested",
						actorId: USER_B,
						createdAt: t(0),
					},
					{
						type: "lease_approved",
						actorId: USER_A,
						createdAt: t(1),
					},
					{
						type: "lease_expired",
						actorId: "system",
						createdAt: t(2),
					},
				],
			},
			// 11. Missing
			{
				name: `${TEST_PREFIX} Missing`,
				claimStatus: "approved",
				claimExtra: {
					requestedAt: t(0),
					approvedAt: t(1),
					pickedUpAt: t(4),
					missingAt: t(5),
				},
				events: [
					{
						type: "lease_requested",
						actorId: USER_B,
						createdAt: t(0),
					},
					{
						type: "lease_approved",
						actorId: USER_A,
						createdAt: t(1),
					},
					{
						type: "lease_pickup_proposed",
						actorId: USER_B,
						createdAt: t(2),
						proposalId: pickupProposalId,
						windowStartAt: t(3),
						windowEndAt: t(3) + ONE_HOUR,
					},
					{
						type: "lease_pickup_approved",
						actorId: USER_A,
						createdAt: t(3),
						proposalId: pickupProposalId,
						windowStartAt: t(3),
						windowEndAt: t(3) + ONE_HOUR,
					},
					{
						type: "lease_picked_up",
						actorId: USER_B,
						createdAt: t(4),
					},
					{
						type: "lease_missing",
						actorId: USER_A,
						createdAt: t(5),
					},
				],
			},
		];

		// ===== CREATE ALL SCENARIOS =====
		const created: string[] = [];
		const itemIds: Record<string, string> = {};

		for (const scenario of scenarios) {
			// Create item (owned by USER_A)
			const itemId = await ctx.db.insert("items", {
				name: scenario.name,
				description: `Test scenario for journey visualization: ${scenario.name.replace(TEST_PREFIX, "").trim()}`,
				ownerId: USER_A,
				category: "other",
			});

			await ctx.db.insert("item_activity", {
				itemId,
				type: "item_created",
				actorId: USER_A,
				createdAt: t(0) - ONE_DAY_MS,
			});

			// Create claim (claimer = USER_B)
			// Lease period uses future dates to avoid "Past due" state on pending claims.
			// Event timestamps (createdAt) use t() which can be in the past — that's fine.
			const claimId = await ctx.db.insert("claims", {
				itemId,
				claimerId: USER_B,
				status: scenario.claimStatus,
				startDate: now + 5 * ONE_DAY_MS,
				endDate: now + 15 * ONE_DAY_MS,
				...scenario.claimExtra,
			});

			// Create events
			for (const event of scenario.events) {
				await ctx.db.insert("lease_activity", {
					itemId,
					claimId,
					type: event.type,
					actorId: event.actorId,
					createdAt: event.createdAt,
					...(event.proposalId ? { proposalId: event.proposalId } : {}),
					...(event.windowStartAt
						? { windowStartAt: event.windowStartAt }
						: {}),
					...(event.windowEndAt ? { windowEndAt: event.windowEndAt } : {}),
				});

				// Mirror relevant lease events into item_activity
				if (event.type === "lease_approved") {
					await ctx.db.insert("item_activity", {
						itemId,
						type: "loan_started",
						actorId: event.actorId,
						createdAt: event.createdAt,
						claimId,
						borrowerId: USER_B,
						startDate: now + 5 * ONE_DAY_MS,
						endDate: now + 15 * ONE_DAY_MS,
					});
				} else if (event.type === "lease_picked_up") {
					await ctx.db.insert("item_activity", {
						itemId,
						type: "item_picked_up",
						actorId: event.actorId,
						createdAt: event.createdAt,
						claimId,
						borrowerId: USER_B,
					});
				} else if (event.type === "lease_returned") {
					await ctx.db.insert("item_activity", {
						itemId,
						type: "item_returned",
						actorId: event.actorId,
						createdAt: event.createdAt,
						claimId,
						borrowerId: USER_B,
					});
				}
			}

			created.push(scenario.name);
			// Store short key → item ID mapping for tests
			const shortKey = scenario.name
				.replace(TEST_PREFIX, "")
				.trim()
				.toLowerCase()
				.replace(/\s+/g, "_");
			itemIds[shortKey] = itemId;
		}

		return {
			success: true,
			deleted: testItems.length,
			created,
			itemIds,
			users: { owner: USER_A, borrower: USER_B },
			howToTest: [
				"Login as USER_B → /en/item/{id} → see journey stepper + timeline",
				"Login as USER_A → My Items → see claims on owned items",
				"npx playwright test e2e/journey-timeline.spec.ts --headed",
			],
		};
	},
});

/**
 * Shift ALL timestamps forward so test data has current dates.
 * Finds the latest endDate across all claims and shifts everything
 * so that claim ends 2 days from now.
 *
 * Run with: npx convex run seed:refreshTestData
 */
export const refreshTestData = mutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();

		// 1. Find the latest endDate among all claims
		const claims = await ctx.db.query("claims").collect();
		if (claims.length === 0) {
			return { error: "No claims found. Run nuclearReset first." };
		}

		let latestEndDate = -Infinity;
		for (const claim of claims) {
			if (claim.endDate > latestEndDate) {
				latestEndDate = claim.endDate;
			}
		}

		// 2. Calculate shift so latest claim ends 2 days from now
		const shiftMs = now - latestEndDate + 2 * ONE_DAY_MS;

		// 3. Patch all claims — shift all timestamp fields
		const claimTimestampFields = [
			"startDate",
			"endDate",
			"requestedAt",
			"approvedAt",
			"rejectedAt",
			"pickedUpAt",
			"returnedAt",
			"transferredAt",
			"expiredAt",
			"missingAt",
		] as const;

		let claimsUpdated = 0;
		for (const claim of claims) {
			const patch: Record<string, number> = {};
			for (const field of claimTimestampFields) {
				const value = claim[field];
				if (value !== undefined) {
					patch[field] = value + shiftMs;
				}
			}
			await ctx.db.patch(claim._id, patch);
			claimsUpdated++;
		}

		// 4. Patch all lease_activity — shift createdAt, windowStartAt, windowEndAt
		const leaseActivity = await ctx.db.query("lease_activity").collect();
		let leaseActivityUpdated = 0;
		for (const activity of leaseActivity) {
			const patch: Record<string, number> = {
				createdAt: activity.createdAt + shiftMs,
			};
			if (activity.windowStartAt !== undefined) {
				patch.windowStartAt = activity.windowStartAt + shiftMs;
			}
			if (activity.windowEndAt !== undefined) {
				patch.windowEndAt = activity.windowEndAt + shiftMs;
			}
			await ctx.db.patch(activity._id, patch);
			leaseActivityUpdated++;
		}

		// 5. Patch all notifications — shift createdAt, windowStartAt, windowEndAt
		const notifications = await ctx.db.query("notifications").collect();
		let notificationsUpdated = 0;
		for (const notification of notifications) {
			const patch: Record<string, number> = {
				createdAt: notification.createdAt + shiftMs,
			};
			if (notification.windowStartAt !== undefined) {
				patch.windowStartAt = notification.windowStartAt + shiftMs;
			}
			if (notification.windowEndAt !== undefined) {
				patch.windowEndAt = notification.windowEndAt + shiftMs;
			}
			await ctx.db.patch(notification._id, patch);
			notificationsUpdated++;
		}

		return {
			success: true,
			shiftDays: Math.round((shiftMs / ONE_DAY_MS) * 10) / 10,
			latestEndDateBefore: new Date(latestEndDate).toISOString(),
			latestEndDateAfter: new Date(latestEndDate + shiftMs).toISOString(),
			updated: {
				claims: claimsUpdated,
				leaseActivity: leaseActivityUpdated,
				notifications: notificationsUpdated,
			},
		};
	},
});
