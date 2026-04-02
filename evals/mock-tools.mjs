// evals/mock-tools.mjs
//
// Mock tool definitions for eval tests.
// Same schemas as the real tools, but execute returns static data.
// This lets the LLM complete the full tool-call loop without Convex.

import { tsImport } from "tsx/esm/api";

const sharryTools = await tsImport("../lib/sharry-tools.ts", import.meta.url);
const { mdLink } = sharryTools.default ?? sharryTools;

const { jsonSchema, tool } = await import("ai");

const ONE_DAY = 86400000;
const today = new Date();
today.setHours(0, 0, 0, 0);
const T = today.getTime();

function s(description) {
	return { type: "string", description };
}

const noParams = jsonSchema({ type: "object", properties: {} });

function itemLink(name, id, locale) {
	return mdLink(name, `/item/${id}`, locale);
}

export function buildMockTools(locale = "en") {
	const link = (name, id) => itemLink(name, id, locale);

	return {
		getMyItems: tool({
			description:
				"List the user's own items with descriptions and categories. Use when the user asks about their listed items. IMPORTANT: Copy the 'summary' field into your response — it contains clickable links.",
			inputSchema: noParams,
			execute: async () => ({
				items: [
					{
						itemId: "item-drill",
						name: "Electric Drill",
						category: "electronics",
						mode: "lending",
						markdownLink: link("Electric Drill", "item-drill"),
					},
					{
						itemId: "item-tent",
						name: "Camping Tent",
						category: "sports",
						mode: "lending",
						markdownLink: link("Camping Tent", "item-tent"),
					},
				],
				summary: `Your 2 item(s):\n- ${link("Electric Drill", "item-drill")} (electronics, lending)\n- ${link("Camping Tent", "item-tent")} (sports, lending)`,
			}),
		}),

		getMyBorrowedItems: tool({
			description:
				"List items the user ALREADY has — currently fostering from other neighbors, with owner name and return dates. Use ONLY when the user asks what they currently have or need to return. Do NOT use when the user wants to find/borrow something new — use browseItems instead. IMPORTANT: Copy the 'summary' field into your response.",
			inputSchema: noParams,
			execute: async () => ({
				items: [
					{
						itemId: "item-telescope",
						name: "Telescope",
						ownerName: "Alex",
						startDate: "3/30/2026",
						endDate: "4/6/2026",
						markdownLink: link("Telescope", "item-telescope"),
					},
				],
				summary: `Fostering 1 item(s):\n- ${link("Telescope", "item-telescope")} from Alex (3/30/2026 – 4/6/2026)`,
			}),
		}),

		browseItems: tool({
			description:
				"Search available items from other neighbors. Filter by name/keyword and/or category. Use when the user wants to FIND or BORROW something new (e.g. 'I need a drill', 'lets borrow iron', 'find me a tent'). This is the go-to tool for any request to get/borrow/find an item. IMPORTANT: Copy the 'summary' field into your response — it contains clickable markdown links.",
			inputSchema: jsonSchema({
				type: "object",
				properties: {
					query: s("Search term to match against item names"),
					category: s(
						"Category: kitchen, furniture, electronics, clothing, books, sports, other",
					),
				},
			}),
			execute: async ({ query, category }) => {
				const all = [
					{
						itemId: "item-iron",
						name: "Waffle Iron",
						description: "Makes great waffles",
						category: "kitchen",
						mode: "lending",
					},
					{
						itemId: "item-keyboard",
						name: "Mechanical Keyboard",
						description: "Cherry MX Blue",
						category: "electronics",
						mode: "lending",
					},
					{
						itemId: "item-sewing",
						name: "Sewing Machine",
						description: "Singer, works great",
						category: "electronics",
						mode: "lending",
					},
					{
						itemId: "item-lantern",
						name: "Camping Lantern",
						description: "LED, rechargeable",
						category: "sports",
						mode: "giveaway",
					},
				];
				let items = all;
				if (query) {
					const q = query.toLowerCase();
					items = items.filter(
						(i) =>
							i.name.toLowerCase().includes(q) ||
							i.description.toLowerCase().includes(q),
					);
				}
				if (category) items = items.filter((i) => i.category === category);
				if (items.length === 0)
					return { items: [], summary: "No items found." };
				const results = items.map((i) => ({
					...i,
					markdownLink: link(i.name, i.itemId),
				}));
				const lines = results.map(
					(r) => `- ${r.markdownLink} — ${r.description}`,
				);
				return {
					items: results,
					summary: `Found ${results.length} item(s):\n${lines.join("\n")}`,
				};
			},
		}),

		getItemDetails: tool({
			description: "Get full details of a specific item by ID.",
			inputSchema: jsonSchema({
				type: "object",
				properties: { itemId: s("The item ID") },
				required: ["itemId"],
			}),
			execute: async ({ itemId }) => ({
				itemId,
				name: "Waffle Iron",
				description: "Makes great waffles",
				category: "kitchen",
				mode: "lending",
				ownerId: "user-alex",
				ownerName: "Alex",
				markdownLink: link("Waffle Iron", itemId),
			}),
		}),

		getItemAvailability: tool({
			description:
				"Get the availability calendar for an item — which date ranges are booked vs free. Also suggests the next free window.",
			inputSchema: jsonSchema({
				type: "object",
				properties: { itemId: s("The item ID") },
				required: ["itemId"],
			}),
			execute: async () => ({
				bookedRanges: [{ from: "3/28/2026", to: "4/4/2026" }],
				nextFreeWindow: "Next available from 4/4/2026",
				summary:
					"1 booked period(s):\n- Booked: 3/28/2026 – 4/4/2026\n\nNext available from 4/4/2026",
			}),
		}),

		getMyCalendar: tool({
			description:
				"Get the user's schedule for a date range — items they're lending, fostering, and vacation blocks. IMPORTANT: Copy the 'summary' field.",
			inputSchema: jsonSchema({
				type: "object",
				properties: { startDate: s("Start (ISO)"), endDate: s("End (ISO)") },
				required: ["startDate", "endDate"],
			}),
			execute: async () => ({
				items: [
					{
						type: "lending",
						title: "Electric Drill",
						startDate: "4/4/2026",
						endDate: "4/7/2026",
						needsAction: "respond_request",
						counterpartyName: "Maria",
						markdownLink: link("Electric Drill", "item-drill"),
					},
					{
						type: "borrowing",
						title: "Telescope",
						startDate: "3/30/2026",
						endDate: "4/6/2026",
						needsAction: null,
						counterpartyName: "Alex",
						markdownLink: link("Telescope", "item-telescope"),
					},
				],
				summary: `Schedule (2 event(s)):\n- 4/4/2026 – 4/7/2026: ${link("Electric Drill", "item-drill")} (lending) ⚠ respond request\n- 3/30/2026 – 4/6/2026: ${link("Telescope", "item-telescope")} (borrowing)`,
			}),
		}),

		getMyBlockedDates: tool({
			description:
				"Get the user's vacation/unavailability blocks. IMPORTANT: Copy the 'summary' field.",
			inputSchema: noParams,
			execute: async () => ({
				items: [
					{
						blockId: "block-1",
						startDate: "4/12/2026",
						endDate: "4/19/2026",
						note: "traveling",
					},
				],
				summary: "1 blocked period(s):\n- 4/12/2026 – 4/19/2026 — traveling",
			}),
		}),

		getLeaseTimeline: tool({
			description:
				"Get the full activity timeline for a specific rental/claim.",
			inputSchema: jsonSchema({
				type: "object",
				properties: { claimId: s("The claim ID") },
				required: ["claimId"],
			}),
			execute: async () => ({
				items: [
					{ type: "requested", createdAt: "3/28/2026" },
					{ type: "approved", createdAt: "3/29/2026" },
					{ type: "picked up", createdAt: "3/31/2026" },
				],
				summary:
					"Timeline (3 event(s)):\n- 3/28/2026: **requested**\n- 3/29/2026: **approved**\n- 3/31/2026: **picked up**",
			}),
		}),

		getClaimsOnItem: tool({
			description:
				"Look up who has requested or is fostering a specific item owned by the user.",
			inputSchema: jsonSchema({
				type: "object",
				properties: { itemName: s("Name of the user's item") },
				required: ["itemName"],
			}),
			execute: async ({ itemName }) => ({
				itemName: "Electric Drill",
				claims: [
					{
						claimId: "claim-1",
						claimerName: "Maria",
						status: "pending",
						startDate: "4/4/2026",
						endDate: "4/7/2026",
					},
				],
			}),
		}),

		getUserProfile: tool({
			description: "Get public profile info for a user by their userId.",
			inputSchema: jsonSchema({
				type: "object",
				properties: { userId: s("The user ID") },
				required: ["userId"],
			}),
			execute: async () => ({
				name: "Alex",
				bio: "Astronomy nerd",
				area: "Ward 1, Da Lat",
				contactMethods: "telegram",
				averageStars: 4.5,
				totalRatings: 8,
			}),
		}),

		getMyProfile: tool({
			description: "Get the current user's own profile.",
			inputSchema: noParams,
			execute: async () => ({
				name: "Test User",
				bio: "Love sharing stuff",
				area: "Ward 3, Da Lat",
				contacts: "telegram: @testuser, whatsapp: +84123456789",
				hasProfile: true,
				summary:
					"Your profile: **Test User** — Love sharing stuff — Ward 3, Da Lat",
			}),
		}),

		getNotifications: tool({
			description:
				"Get the user's recent notifications. IMPORTANT: Copy the 'summary' field.",
			inputSchema: noParams,
			execute: async () => ({
				items: [
					{
						type: "new request",
						isRead: false,
						itemName: "Electric Drill",
						markdownLink: link("Electric Drill", "item-drill"),
						createdAt: "4/1/2026",
					},
					{
						type: "claim approved",
						isRead: true,
						itemName: "Telescope",
						markdownLink: link("Telescope", "item-telescope"),
						createdAt: "3/30/2026",
					},
				],
				summary: `2 notification(s):\n- new request — ${link("Electric Drill", "item-drill")} (new) (4/1/2026)\n- claim approved — ${link("Telescope", "item-telescope")} (3/30/2026)`,
			}),
		}),

		getMyPendingRatings: tool({
			description: "Get transactions the user hasn't rated yet.",
			inputSchema: noParams,
			execute: async () => ({
				items: [
					{
						claimId: "claim-blender",
						itemName: "Blender",
						targetRole: "lender",
						targetUserName: "Bob",
						markdownLink: link("Blender", "item-blender"),
					},
				],
				summary: `1 pending rating(s):\n- ${link("Blender", "item-blender")} — rate Bob as lender`,
			}),
		}),

		browseWishlist: tool({
			description:
				"List wishlist items with vote counts. IMPORTANT: Copy the 'summary' field.",
			inputSchema: noParams,
			execute: async () => ({
				items: [
					{
						wishId: "wish-1",
						text: "Standing desk",
						votes: 2,
						isOwner: false,
						isLiked: false,
					},
					{
						wishId: "wish-2",
						text: "Pressure cooker",
						votes: 1,
						isOwner: true,
						isLiked: true,
					},
				],
				summary:
					"Wishlist (2 wish(es)):\n- **Standing desk** — 2 vote(s), 0 match(es)\n- **Pressure cooker** (yours) — 1 vote(s), 1 match(es) ✓ voted",
			}),
		}),

		navigateTo: tool({
			description: "Generate a link to a page in the app.",
			inputSchema: jsonSchema({
				type: "object",
				properties: {
					page: {
						type: "string",
						enum: [
							"home",
							"my-items",
							"profile",
							"wishlist",
							"notifications",
							"item-detail",
						],
					},
					itemId: s("Required for item-detail page"),
				},
				required: ["page"],
			}),
			execute: async ({ page, itemId }) => {
				const paths = {
					home: `/${locale}`,
					"my-items": `/${locale}/my-items`,
					profile: `/${locale}/profile`,
					wishlist: `/${locale}/wishlist`,
					notifications: `/${locale}/notifications`,
					"item-detail": `/${locale}/item/${itemId ?? ""}`,
				};
				return { url: paths[page] ?? `/${locale}` };
			},
		}),

		// Mutation tools — schema only, mock success responses
		createItem: tool({
			description: "Create a new item listing.",
			inputSchema: jsonSchema({
				type: "object",
				properties: {
					name: s("Item name"),
					description: s("Description"),
					category: s("Category"),
					imageIndices: { type: "array", items: { type: "number" } },
				},
				required: ["name"],
			}),
			needsApproval: true,
			execute: async ({ name }) => ({
				success: `Created "${name}".`,
				nextStep: `${link(name, "new-item")}`,
			}),
		}),

		updateItem: tool({
			description: "Update an existing item.",
			inputSchema: jsonSchema({
				type: "object",
				properties: {
					itemName: s("Current name"),
					name: s("New name"),
					description: s("New description"),
					category: s("New category"),
				},
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async ({ itemName }) => ({ success: `Updated "${itemName}".` }),
		}),

		deleteItem: tool({
			description: "Permanently delete an item. HIGH RISK.",
			inputSchema: jsonSchema({
				type: "object",
				properties: { itemName: s("Item to delete") },
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async ({ itemName }) => ({ success: `Deleted "${itemName}".` }),
		}),

		approveClaim: tool({
			description: "Approve a pending request on your item.",
			inputSchema: jsonSchema({
				type: "object",
				properties: {
					itemName: s("Item name"),
					claimerName: s("Requester name"),
				},
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async ({ itemName }) => ({
				success: `Approved request on "${itemName}".`,
			}),
		}),

		rejectClaim: tool({
			description: "Reject a pending request on your item.",
			inputSchema: jsonSchema({
				type: "object",
				properties: {
					itemName: s("Item name"),
					claimerName: s("Requester name"),
				},
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async ({ itemName }) => ({
				success: `Rejected request on "${itemName}".`,
			}),
		}),

		requestItem: tool({
			description: "Request to borrow an item. Needs item ID and dates.",
			inputSchema: jsonSchema({
				type: "object",
				properties: {
					itemId: s("Item ID"),
					startDate: s("Start date ISO"),
					endDate: s("End date ISO"),
				},
				required: ["itemId", "startDate", "endDate"],
			}),
			needsApproval: true,
			execute: async ({ startDate, endDate }) => ({
				success: `Request sent for ${startDate} to ${endDate}.`,
			}),
		}),

		cancelMyClaim: tool({
			description: "Cancel your own pending request.",
			inputSchema: jsonSchema({
				type: "object",
				properties: { itemName: s("Item name") },
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async ({ itemName }) => ({
				success: `Cancelled request on "${itemName}".`,
			}),
		}),

		blockDates: tool({
			description: "Block a date range on your calendar.",
			inputSchema: jsonSchema({
				type: "object",
				properties: {
					startDate: s("Start ISO"),
					endDate: s("End ISO"),
					note: s("Reason"),
				},
				required: ["startDate", "endDate"],
			}),
			needsApproval: true,
			execute: async ({ startDate, endDate }) => ({
				success: `Blocked ${startDate} to ${endDate}.`,
			}),
		}),

		unblockDates: tool({
			description: "Remove a vacation block. Call getMyBlockedDates first.",
			inputSchema: jsonSchema({
				type: "object",
				properties: { blockId: s("Block ID from getMyBlockedDates") },
				required: ["blockId"],
			}),
			needsApproval: true,
			execute: async () => ({ success: "Removed blocked dates." }),
		}),

		switchItemMode: tool({
			description: "Toggle item between lending and giveaway mode.",
			inputSchema: jsonSchema({
				type: "object",
				properties: { itemName: s("Item name"), giveaway: { type: "boolean" } },
				required: ["itemName", "giveaway"],
			}),
			needsApproval: true,
			execute: async ({ itemName, giveaway }) => ({
				success: `Switched "${itemName}" to ${giveaway ? "giveaway" : "lending"}.`,
			}),
		}),

		createRating: tool({
			description: "Rate a completed transaction.",
			inputSchema: jsonSchema({
				type: "object",
				properties: {
					claimId: s("Claim ID"),
					stars: { type: "number" },
					comment: s("Review"),
				},
				required: ["claimId", "stars"],
			}),
			needsApproval: true,
			execute: async ({ stars }) => ({
				success: `Submitted ${stars}-star rating.`,
			}),
		}),

		checkWishlist: tool({
			description: "Check existing wishlist for duplicates before creating.",
			inputSchema: jsonSchema({
				type: "object",
				properties: { query: s("What to search for") },
				required: ["query"],
			}),
			execute: async () => ({
				existingWishes: [
					{ wishId: "wish-1", text: "Standing desk", votes: 2, isOwner: false },
				],
			}),
		}),

		createWishlistItem: tool({
			description:
				"Add a wish. ALWAYS call browseItems AND checkWishlist first.",
			inputSchema: jsonSchema({
				type: "object",
				properties: { text: s("What you want") },
				required: ["text"],
			}),
			needsApproval: true,
			execute: async ({ text }) => ({
				success: `Added to wishlist: "${text}".`,
			}),
		}),

		voteWishlistItem: tool({
			description: "Vote on a wishlist item.",
			inputSchema: jsonSchema({
				type: "object",
				properties: { wishId: s("Wish ID"), wishText: s("Wish text") },
				required: ["wishId"],
			}),
			needsApproval: true,
			execute: async ({ wishText }) => ({
				success: `Vote toggled on "${wishText ?? "wish"}".`,
			}),
		}),

		updateWishlistItem: tool({
			description: "Update a wish's text.",
			inputSchema: jsonSchema({
				type: "object",
				properties: { wishId: s("Wish ID"), text: s("New text") },
				required: ["wishId", "text"],
			}),
			needsApproval: true,
			execute: async ({ text }) => ({ success: `Updated wish: "${text}".` }),
		}),

		deleteWishlistItem: tool({
			description: "Delete a wish. Cannot be undone.",
			inputSchema: jsonSchema({
				type: "object",
				properties: { wishId: s("Wish ID"), wishText: s("Wish text") },
				required: ["wishId"],
			}),
			needsApproval: true,
			execute: async ({ wishText }) => ({
				success: `Deleted wish: "${wishText ?? "wish"}".`,
			}),
		}),

		subscribeToAvailability: tool({
			description: "Toggle availability alerts for an item.",
			inputSchema: jsonSchema({
				type: "object",
				properties: { itemId: s("Item ID") },
				required: ["itemId"],
			}),
			needsApproval: true,
			execute: async () => ({
				success: "You'll be notified when this item becomes available.",
			}),
		}),

		updateProfile: tool({
			description: "Update profile: name, bio, address, contacts.",
			inputSchema: jsonSchema({
				type: "object",
				properties: { name: s("Name"), bio: s("Bio"), address: s("Address") },
			}),
			needsApproval: true,
			execute: async () => ({ success: "Profile updated." }),
		}),

		markAllNotificationsRead: tool({
			description: "Mark all notifications as read.",
			inputSchema: noParams,
			needsApproval: true,
			execute: async () => ({ success: "All notifications marked as read." }),
		}),

		proposePickupWindow: tool({
			description: "Propose a 1-hour pickup time.",
			inputSchema: jsonSchema({
				type: "object",
				properties: { itemName: s("Item"), dateTime: s("Pickup time ISO") },
				required: ["itemName", "dateTime"],
			}),
			needsApproval: true,
			execute: async ({ dateTime }) => ({
				success: `Pickup proposed for ${dateTime}.`,
			}),
		}),

		approvePickupWindow: tool({
			description: "Approve a proposed pickup time.",
			inputSchema: jsonSchema({
				type: "object",
				properties: { itemName: s("Item") },
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async () => ({ success: "Pickup time approved." }),
		}),

		proposeReturnWindow: tool({
			description: "Propose a 1-hour return time.",
			inputSchema: jsonSchema({
				type: "object",
				properties: { itemName: s("Item"), dateTime: s("Return time ISO") },
				required: ["itemName", "dateTime"],
			}),
			needsApproval: true,
			execute: async ({ dateTime }) => ({
				success: `Return proposed for ${dateTime}.`,
			}),
		}),

		approveReturnWindow: tool({
			description: "Approve a proposed return time.",
			inputSchema: jsonSchema({
				type: "object",
				properties: { itemName: s("Item") },
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async () => ({ success: "Return time approved." }),
		}),

		markPickedUp: tool({
			description: "Confirm an item has been picked up.",
			inputSchema: jsonSchema({
				type: "object",
				properties: { itemName: s("Item") },
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async ({ itemName }) => ({
				success: `Marked "${itemName}" as picked up.`,
			}),
		}),

		markReturned: tool({
			description: "Confirm an item has been returned.",
			inputSchema: jsonSchema({
				type: "object",
				properties: { itemName: s("Item") },
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async ({ itemName }) => ({
				success: `Marked "${itemName}" as returned.`,
			}),
		}),

		markMissing: tool({
			description: "Report an item as lost/missing. HIGH RISK.",
			inputSchema: jsonSchema({
				type: "object",
				properties: { itemName: s("Item"), note: s("What happened") },
				required: ["itemName"],
			}),
			needsApproval: true,
			execute: async ({ itemName }) => ({
				success: `Reported "${itemName}" as missing.`,
			}),
		}),
	};
}
