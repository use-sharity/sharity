// Demo seed for local-only testing via Cloudflare tunnel.
// Uploads curated Unsplash photos into the project's Cloudinary,
// then inserts 10 beautiful dummy items per user (A and B).
//
// Safe by design:
// - internalAction + internalMutation (not callable from the public HTTP API)
// - Adds items, never deletes anything (unrelated to the 2026-04-03 wipe incident)
// - Run via:  pnpx convex run seedDemo:seedDemoItems '{"userAId":"...","userBId":"..."}'

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";
import { vCloudinaryRef } from "./mediaTypes";

// ---------- Cloudinary helper (copied from media_migrations.ts to avoid coupling) ----------

type CloudinaryConfig = {
	cloudName: string;
	apiKey: string;
	apiSecret: string;
};

function getCloudinaryConfig(): CloudinaryConfig {
	const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
	const apiKey = process.env.CLOUDINARY_API_KEY;
	const apiSecret = process.env.CLOUDINARY_API_SECRET;
	if (!cloudName || !apiKey || !apiSecret) {
		throw new Error(
			"Missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET in Convex env",
		);
	}
	return { cloudName, apiKey, apiSecret };
}

async function sha1Hex(input: string): Promise<string> {
	const bytes = new TextEncoder().encode(input);
	const digest = await crypto.subtle.digest("SHA-1", bytes);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

async function uploadRemoteUrlToCloudinary(args: {
	config: CloudinaryConfig;
	fileUrl: string;
	folder: string;
	tags: string[];
}): Promise<{ publicId: string; secureUrl: string }> {
	const { cloudName, apiKey, apiSecret } = args.config;
	const timestamp = Math.floor(Date.now() / 1000);
	const tags = args.tags.join(",");

	const paramsToSign = [
		`folder=${args.folder}`,
		`tags=${tags}`,
		`timestamp=${timestamp}`,
	].join("&");
	const signature = await sha1Hex(`${paramsToSign}${apiSecret}`);

	const formData = new FormData();
	formData.set("file", args.fileUrl);
	formData.set("api_key", apiKey);
	formData.set("timestamp", String(timestamp));
	formData.set("signature", signature);
	formData.set("folder", args.folder);
	formData.set("tags", tags);

	const response = await fetch(
		`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
		{ method: "POST", body: formData },
	);

	const data = (await response.json()) as
		| { public_id?: string; secure_url?: string; error?: { message?: string } }
		| undefined;

	if (!response.ok) {
		const message = data?.error?.message || `HTTP ${response.status}`;
		throw new Error(`Cloudinary upload failed: ${message}`);
	}
	if (!data?.public_id || !data.secure_url) {
		throw new Error("Cloudinary upload returned missing public_id/secure_url");
	}
	return { publicId: data.public_id, secureUrl: data.secure_url };
}

// ---------- Internal mutation to insert an item ----------

export const _insertDemoItem = internalMutation({
	args: {
		ownerId: v.string(),
		name: v.string(),
		description: v.string(),
		category: v.union(
			v.literal("kitchen"),
			v.literal("furniture"),
			v.literal("electronics"),
			v.literal("clothing"),
			v.literal("books"),
			v.literal("sports"),
			v.literal("other"),
		),
		minLeaseDays: v.number(),
		maxLeaseDays: v.number(),
		giveaway: v.boolean(),
		imageCloudinary: v.array(vCloudinaryRef),
		location: v.object({
			lat: v.number(),
			lng: v.number(),
			address: v.optional(v.string()),
			ward: v.optional(v.string()),
		}),
	},
	handler: async (ctx, args) => {
		const id = await ctx.db.insert("items", {
			ownerId: args.ownerId,
			name: args.name,
			description: args.description,
			category: args.category,
			minLeaseDays: args.minLeaseDays,
			maxLeaseDays: args.maxLeaseDays,
			giveaway: args.giveaway,
			imageCloudinary: args.imageCloudinary,
			location: args.location,
		});
		return id;
	},
});

// ---------- Data ----------

type Category =
	| "kitchen"
	| "furniture"
	| "electronics"
	| "clothing"
	| "books"
	| "sports"
	| "other";

type DemoItem = {
	name: string;
	description: string;
	category: Category;
	minLeaseDays: number;
	maxLeaseDays: number;
	ward: string;
	// Jitter around Dalat center (11.9404, 108.4583)
	latOffset: number;
	lngOffset: number;
	unsplashId: string; // photo-XXXXXXXX
};

const DALAT_CENTER = { lat: 11.9404, lng: 108.4583 };

function unsplashUrl(id: string): string {
	return `https://images.unsplash.com/${id}?w=1400&q=80&fm=jpg&auto=format`;
}

const ITEMS_A: DemoItem[] = [
	{
		name: "Delonghi Espresso Machine",
		description:
			"Semi-automatic espresso maker with steam wand. Makes great lattes and cappuccinos. Comes with portafilter and tamper. Perfect for a weekend of home-barista fun.",
		category: "kitchen",
		minLeaseDays: 1,
		maxLeaseDays: 7,
		ward: "Phường 1",
		latOffset: 0.004,
		lngOffset: -0.003,
		unsplashId: "photo-1495474472287-4d71bcdd2085",
	},
	{
		name: "Canon EOS R6 + 24-105mm Lens",
		description:
			"Full-frame mirrorless camera kit. Excellent for travel, portraits and low-light shots. Includes extra battery, 64GB SD card and a camera strap.",
		category: "electronics",
		minLeaseDays: 1,
		maxLeaseDays: 5,
		ward: "Phường 2",
		latOffset: -0.005,
		lngOffset: 0.002,
		unsplashId: "photo-1502920917128-1aa500764cbd",
	},
	{
		name: "Yoga Mat + Cork Blocks",
		description:
			"Premium 6mm non-slip yoga mat with two cork blocks and a cotton strap. Cleaned and aired between uses. Pickup in central Dalat.",
		category: "sports",
		minLeaseDays: 1,
		maxLeaseDays: 14,
		ward: "Phường 3",
		latOffset: 0.007,
		lngOffset: 0.005,
		unsplashId: "photo-1545205597-3d9d02c29597",
	},
	{
		name: "Russian Literature Collection (6 volumes)",
		description:
			"Hardcover set: Dostoevsky, Tolstoy, Chekhov, Bulgakov, Pasternak, Nabokov. Original Russian editions in very good condition. Great for long cozy evenings.",
		category: "books",
		minLeaseDays: 7,
		maxLeaseDays: 30,
		ward: "Phường 4",
		latOffset: -0.008,
		lngOffset: -0.006,
		unsplashId: "photo-1512820790803-83ca734da794",
	},
	{
		name: "Men's Leather Jacket, Size L",
		description:
			"Classic black moto-style jacket, genuine leather. Fits 180-188cm, chest up to 104cm. Comfortable for Dalat evenings and bike rides.",
		category: "clothing",
		minLeaseDays: 1,
		maxLeaseDays: 7,
		ward: "Phường 5",
		latOffset: 0.003,
		lngOffset: 0.008,
		unsplashId: "photo-1551028719-00167b16eac5",
	},
	{
		name: 'Mountain Bike (27.5", M frame)',
		description:
			"Hardtail MTB with hydraulic disc brakes, 1x11 drivetrain. Recently serviced. Includes helmet and a small repair kit. Great for Dalat hills.",
		category: "sports",
		minLeaseDays: 1,
		maxLeaseDays: 7,
		ward: "Phường 6",
		latOffset: -0.01,
		lngOffset: 0.004,
		unsplashId: "photo-1485965120184-e220f721d03e",
	},
	{
		name: "Electric Burr Coffee Grinder",
		description:
			"Flat burr grinder with stepped settings from espresso to French press. Consistent grind, easy to clean. Pairs great with the espresso machine.",
		category: "kitchen",
		minLeaseDays: 1,
		maxLeaseDays: 14,
		ward: "Phường 7",
		latOffset: 0.006,
		lngOffset: -0.007,
		unsplashId: "photo-1559525839-d9acfd510448",
	},
	{
		name: "Board Games Bundle (5 titles)",
		description:
			"Catan, Ticket to Ride, Azul, Codenames and Carcassonne. All pieces intact, English rules included. Perfect rainy-Dalat-afternoon starter pack.",
		category: "other",
		minLeaseDays: 1,
		maxLeaseDays: 14,
		ward: "Phường 8",
		latOffset: -0.004,
		lngOffset: 0.007,
		unsplashId: "photo-1610890716171-6b1bb98ffd09",
	},
	{
		name: "JBL Flip 6 Bluetooth Speaker",
		description:
			"Portable waterproof speaker, ~12h battery, rich bass. Great for picnics and small gatherings. Comes with USB-C charger.",
		category: "electronics",
		minLeaseDays: 1,
		maxLeaseDays: 7,
		ward: "Phường 9",
		latOffset: 0.009,
		lngOffset: 0.001,
		unsplashId: "photo-1608043152269-423dbba4e7e1",
	},
	{
		name: "2-Person Camping Tent + Groundsheet",
		description:
			"Lightweight 2p dome tent (2.4kg), waterproof fly, easy 5-minute pitch. Includes footprint and stake bag. Used twice, like new.",
		category: "sports",
		minLeaseDays: 1,
		maxLeaseDays: 10,
		ward: "Phường 10",
		latOffset: -0.002,
		lngOffset: -0.009,
		unsplashId: "photo-1504280390367-361c6d9f38f4",
	},
];

const ITEMS_B: DemoItem[] = [
	{
		name: "KitchenAid Stand Mixer (Artisan)",
		description:
			"Tilt-head 4.8L stand mixer with dough hook, whisk and paddle. Powerful for bread, pizza, cakes. Color: empire red.",
		category: "kitchen",
		minLeaseDays: 1,
		maxLeaseDays: 7,
		ward: "Phường 1",
		latOffset: -0.006,
		lngOffset: 0.006,
		unsplashId: "photo-1578984712060-7a21a7d0c49b",
	},
	{
		name: "Nintendo Switch + 3 Games",
		description:
			"Nintendo Switch V2 with dock, 2 Joy-Cons and 3 physical games (Zelda BOTW, Mario Odyssey, Mario Kart 8). Works on TV or handheld.",
		category: "electronics",
		minLeaseDays: 1,
		maxLeaseDays: 7,
		ward: "Phường 2",
		latOffset: 0.005,
		lngOffset: -0.008,
		unsplashId: "photo-1578303512597-81e6cc155b3e",
	},
	{
		name: "Beginner Surfboard (7'6\" Funboard)",
		description:
			"Soft-top funboard, great for Mui Ne / Vung Tau trips. Includes leash and a basic travel bag. Dings cosmetic only.",
		category: "sports",
		minLeaseDays: 1,
		maxLeaseDays: 10,
		ward: "Phường 3",
		latOffset: -0.003,
		lngOffset: 0.009,
		unsplashId: "photo-1502680390469-be75c86b636f",
	},
	{
		name: "Vintage Typewriter (Olivetti Lettera)",
		description:
			"Working mid-century portable typewriter. Fresh ribbon installed. A beautiful companion for handwriting letters and journaling.",
		category: "other",
		minLeaseDays: 7,
		maxLeaseDays: 30,
		ward: "Phường 4",
		latOffset: 0.008,
		lngOffset: 0.003,
		unsplashId: "photo-1456735190827-d1262f71b8a3",
	},
	{
		name: "Acoustic Guitar (Yamaha FG800)",
		description:
			"Dreadnought acoustic with solid spruce top. Warm, full sound, easy playability. Includes soft gig bag, capo and a pack of spare strings.",
		category: "other",
		minLeaseDays: 1,
		maxLeaseDays: 14,
		ward: "Phường 5",
		latOffset: -0.007,
		lngOffset: -0.004,
		unsplashId: "photo-1510915361894-db8b60106cb1",
	},
	{
		name: "Women's Winter Coat, Size M",
		description:
			"Knee-length wool blend coat, warm enough for Dalat's cold months. Neutral camel color, fits chest 88-94cm. Dry-cleaned before handoff.",
		category: "clothing",
		minLeaseDays: 1,
		maxLeaseDays: 14,
		ward: "Phường 6",
		latOffset: 0.002,
		lngOffset: -0.005,
		unsplashId: "photo-1544022613-e87ca75a784a",
	},
	{
		name: "Asian Cookbook Collection (4 books)",
		description:
			"Vietnamese, Thai, Japanese and Korean cookbooks — all in English, beautifully photographed. Great for exploring regional cuisines at home.",
		category: "books",
		minLeaseDays: 7,
		maxLeaseDays: 30,
		ward: "Phường 7",
		latOffset: -0.009,
		lngOffset: 0.002,
		unsplashId: "photo-1589994965851-a8f479c573a9",
	},
	{
		name: "Industrial Desk Lamp (adjustable)",
		description:
			"Metal architect-style desk lamp with long articulated arm. Warm 3000K bulb included. Perfect for reading nook or home office.",
		category: "furniture",
		minLeaseDays: 1,
		maxLeaseDays: 30,
		ward: "Phường 8",
		latOffset: 0.004,
		lngOffset: 0.01,
		unsplashId: "photo-1507473885765-e6ed057f782c",
	},
	{
		name: "DJI Mini 3 Drone",
		description:
			"Under-250g drone with 4K camera, 3-axis gimbal. ~38 min flight time on the intelligent battery. Extra propellers and a carry case included.",
		category: "electronics",
		minLeaseDays: 1,
		maxLeaseDays: 5,
		ward: "Phường 9",
		latOffset: -0.001,
		lngOffset: -0.01,
		unsplashId: "photo-1473968512647-3e447244af8f",
	},
	{
		name: "Picnic Basket Set for 4",
		description:
			"Wicker basket with plates, glasses, cutlery and a soft cooler bag — everything you need for a picnic at Tuyen Lam Lake.",
		category: "other",
		minLeaseDays: 1,
		maxLeaseDays: 7,
		ward: "Phường 10",
		latOffset: 0.01,
		lngOffset: -0.001,
		unsplashId: "photo-1509565840781-5ad89b57ad37",
	},
];

// ---------- Retry action for failed items (new Unsplash IDs) ----------

const RETRY_ITEMS: Array<{ owner: "A" | "B"; item: DemoItem }> = [
	{
		owner: "A",
		item: {
			name: "Electric Burr Coffee Grinder",
			description:
				"Flat burr grinder with stepped settings from espresso to French press. Consistent grind, easy to clean. Pairs great with the espresso machine.",
			category: "kitchen",
			minLeaseDays: 1,
			maxLeaseDays: 14,
			ward: "Phường 7",
			latOffset: 0.006,
			lngOffset: -0.007,
			unsplashId: "photo-1515664069236-68a74c369d97",
		},
	},
	{
		owner: "B",
		item: {
			name: "KitchenAid Stand Mixer (Artisan)",
			description:
				"Tilt-head 4.8L stand mixer with dough hook, whisk and paddle. Powerful for bread, pizza, cakes. Color: empire red.",
			category: "kitchen",
			minLeaseDays: 1,
			maxLeaseDays: 7,
			ward: "Phường 1",
			latOffset: -0.006,
			lngOffset: 0.006,
			unsplashId: "photo-1556909114-f6e7ad7d3136",
		},
	},
	{
		owner: "B",
		item: {
			name: "Picnic Basket Set for 4",
			description:
				"Wicker basket with plates, glasses, cutlery and a soft cooler bag — everything you need for a picnic at Tuyen Lam Lake.",
			category: "other",
			minLeaseDays: 1,
			maxLeaseDays: 7,
			ward: "Phường 10",
			latOffset: 0.01,
			lngOffset: -0.001,
			unsplashId: "photo-1504754524776-8f4f37790ca0",
		},
	},
];

export const retryFailedDemoItems = internalAction({
	args: { userAId: v.string(), userBId: v.string() },
	handler: async (ctx, args) => {
		const config = getCloudinaryConfig();
		const results: {
			owner: string;
			name: string;
			ok: boolean;
			msg?: string;
		}[] = [];
		for (const { owner, item } of RETRY_ITEMS) {
			const ownerId = owner === "A" ? args.userAId : args.userBId;
			try {
				const uploaded = await uploadRemoteUrlToCloudinary({
					config,
					fileUrl: unsplashUrl(item.unsplashId),
					folder: "sharity-demo",
					tags: ["demo-seed", `owner-${owner}`, item.category],
				});
				await ctx.runMutation(internal.seedDemo._insertDemoItem, {
					ownerId,
					name: item.name,
					description: item.description,
					category: item.category,
					minLeaseDays: item.minLeaseDays,
					maxLeaseDays: item.maxLeaseDays,
					giveaway: false,
					imageCloudinary: [
						{ publicId: uploaded.publicId, secureUrl: uploaded.secureUrl },
					],
					location: {
						lat: DALAT_CENTER.lat + item.latOffset,
						lng: DALAT_CENTER.lng + item.lngOffset,
						address: `${item.ward}, Đà Lạt, Lâm Đồng`,
						ward: item.ward,
					},
				});
				results.push({ owner, name: item.name, ok: true });
			} catch (e) {
				results.push({
					owner,
					name: item.name,
					ok: false,
					msg: e instanceof Error ? e.message : String(e),
				});
			}
		}
		return results;
	},
});

// ---------- Action ----------

export const seedDemoItems = internalAction({
	args: {
		userAId: v.string(),
		userBId: v.string(),
	},
	handler: async (ctx, args) => {
		const config = getCloudinaryConfig();
		const results: {
			owner: string;
			name: string;
			ok: boolean;
			msg?: string;
		}[] = [];

		const seedOne = async (
			ownerId: string,
			item: DemoItem,
			ownerLabel: string,
		) => {
			try {
				const uploaded = await uploadRemoteUrlToCloudinary({
					config,
					fileUrl: unsplashUrl(item.unsplashId),
					folder: "sharity-demo",
					tags: ["demo-seed", `owner-${ownerLabel}`, item.category],
				});
				await ctx.runMutation(internal.seedDemo._insertDemoItem, {
					ownerId,
					name: item.name,
					description: item.description,
					category: item.category,
					minLeaseDays: item.minLeaseDays,
					maxLeaseDays: item.maxLeaseDays,
					giveaway: false,
					imageCloudinary: [
						{ publicId: uploaded.publicId, secureUrl: uploaded.secureUrl },
					],
					location: {
						lat: DALAT_CENTER.lat + item.latOffset,
						lng: DALAT_CENTER.lng + item.lngOffset,
						address: `${item.ward}, Đà Lạt, Lâm Đồng`,
						ward: item.ward,
					},
				});
				results.push({ owner: ownerLabel, name: item.name, ok: true });
			} catch (e) {
				results.push({
					owner: ownerLabel,
					name: item.name,
					ok: false,
					msg: e instanceof Error ? e.message : String(e),
				});
			}
		};

		for (const item of ITEMS_A) {
			await seedOne(args.userAId, item, "A");
		}
		for (const item of ITEMS_B) {
			await seedOne(args.userBId, item, "B");
		}

		const ok = results.filter((r) => r.ok).length;
		const fail = results.length - ok;
		return {
			summary: `Inserted ${ok}/${results.length} items (${fail} failed)`,
			results,
		};
	},
});
