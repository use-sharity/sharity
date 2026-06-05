import { CloudinaryClient } from "@imaxis/cloudinary-convex";
import { v } from "convex/values";
import { api, components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { vCloudinaryRef } from "./mediaTypes";
import { buildItemSearchText } from "./searchText";

type ResolvedUser = {
  email: string;
  name: string;
  profile: Doc<"users">;
};

async function resolveUserEmail(
  ctx: MutationCtx,
  clerkId: string,
  context: string,
): Promise<ResolvedUser | null> {
  const profile = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
    .first();

  if (!profile?.email) {
    console.warn(
      `[email skip] ${context}: user ${clerkId} has no email on file. ` +
        "Run users:backfillEmailsFromClerk or set up the Clerk webhook.",
    );
    return null;
  }

  return { email: profile.email, name: profile.name ?? "there", profile };
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
// Maximum time in the past that a window proposal can start (allows proposing windows
// that have just started, e.g., proposing 21:00–22:00 at 21:05)
const MAX_PAST_WINDOW_TOLERANCE_MS = ONE_HOUR_MS;
const cloudinary = new CloudinaryClient(components.cloudinary);
const INTERNAL_TEST_ITEM_PREFIXES = [
  "[CAL]",
  "[TEST]",
  "Simplified Lifecycle",
];

type MediaImage =
  | { source: "cloudinary"; publicId: string; url: string }
  | { source: "storage"; storageId: Id<"_storage">; url: string };

type PublicItem = Doc<"items"> & {
  images: MediaImage[];
  imageUrls: string[];
  isRequested: boolean;
  isOwn: boolean;
};

type OwnerSummary = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
};

type PublicDiscoveryItem = PublicItem & {
  owner: OwnerSummary;
};

function isInternalTestItem(item: Doc<"items">): boolean {
  return INTERNAL_TEST_ITEM_PREFIXES.some((prefix) =>
    item.name.startsWith(prefix),
  );
}

async function resolveImages(args: {
  ctx: { storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> } };
  imageCloudinary?: { publicId: string; secureUrl: string }[];
  imageStorageIds?: Id<"_storage">[];
}): Promise<{ images: MediaImage[]; imageUrls: string[] }> {
  const cloud = (args.imageCloudinary ?? [])
    .filter(
      (img) =>
        img.secureUrl.includes("res.cloudinary.com") &&
        img.secureUrl.includes("/image/upload/"),
    )
    .map((img) => ({
      source: "cloudinary" as const,
      publicId: img.publicId,
      url: img.secureUrl,
    }));

  // Cloudinary-only: Convex Storage images are intentionally ignored to avoid
  // ever returning large raw Convex image URLs to the client.
  return { images: cloud, imageUrls: cloud.map((i) => i.url) };
}

async function getActiveClaimedItemIds(
  ctx: QueryCtx,
  userId: string,
): Promise<Set<Id<"items">>> {
  const myClaims = await ctx.db
    .query("claims")
    .withIndex("by_claimer", (q) => q.eq("claimerId", userId))
    .collect();

  return new Set(
    myClaims
      .filter((c) => {
        if (c.status === "pending") return true;
        if (c.status === "approved") {
          return (
            !c.returnedAt && !c.transferredAt && !c.expiredAt && !c.missingAt
          );
        }
        return false;
      })
      .map((c) => c.itemId),
  );
}

async function resolvePublicItem(args: {
  ctx: QueryCtx;
  item: Doc<"items">;
  viewerId?: string;
  claimedItemIds?: Set<Id<"items">>;
}): Promise<PublicItem> {
  const { images, imageUrls } = await resolveImages({
    ctx: args.ctx,
    imageCloudinary: args.item.imageCloudinary,
    imageStorageIds: args.item.imageStorageIds,
  });

  const isOwn = args.viewerId === args.item.ownerId;

  return {
    ...args.item,
    images,
    imageUrls,
    isRequested: isOwn
      ? false
      : (args.claimedItemIds?.has(args.item._id) ?? false),
    isOwn,
  };
}

async function getOwnerSummary(
  ctx: QueryCtx,
  ownerId: string,
): Promise<OwnerSummary> {
  const profile = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", ownerId))
    .first();

  return {
    id: ownerId,
    name: profile?.name ?? null,
    avatarUrl: profile?.avatarCloudinary?.secureUrl ?? null,
  };
}

async function resolveDiscoveryItems(args: {
  ctx: QueryCtx;
  items: Doc<"items">[];
  viewerId?: string;
  claimedItemIds?: Set<Id<"items">>;
}): Promise<PublicDiscoveryItem[]> {
  const ownerCache = new Map<string, Promise<OwnerSummary>>();

  return Promise.all(
    args.items.map(async (item) => {
      const owner =
        ownerCache.get(item.ownerId) ?? getOwnerSummary(args.ctx, item.ownerId);
      ownerCache.set(item.ownerId, owner);

      const publicItem = await resolvePublicItem({
        ctx: args.ctx,
        item,
        viewerId: args.viewerId,
        claimedItemIds: args.claimedItemIds,
      });

      return {
        ...publicItem,
        owner: await owner,
      };
    }),
  );
}

function assertValidLeaseDaysLimits(args: {
  giveaway: boolean;
  minLeaseDays: number | undefined;
  maxLeaseDays: number | undefined;
}): void {
  const { giveaway, minLeaseDays, maxLeaseDays } = args;

  if (giveaway) {
    if (minLeaseDays !== undefined || maxLeaseDays !== undefined) {
      throw new Error("Lease limits are not allowed for giveaway items");
    }
    return;
  }

  const assertPositiveInt = (label: string, value: number) => {
    if (!Number.isInteger(value)) {
      throw new Error(`${label} must be an integer number of days`);
    }
    if (value < 1) {
      throw new Error(`${label} must be at least 1 day`);
    }
  };

  if (minLeaseDays !== undefined)
    assertPositiveInt("Min lease length", minLeaseDays);
  if (maxLeaseDays !== undefined)
    assertPositiveInt("Max lease length", maxLeaseDays);

  if (
    minLeaseDays !== undefined &&
    maxLeaseDays !== undefined &&
    minLeaseDays > maxLeaseDays
  ) {
    throw new Error(
      "Min lease length must be less than or equal to max lease length",
    );
  }
}

function otherPartyId(args: {
  itemOwnerId: string;
  claimerId: string;
  actorId: string;
}): string {
  const { itemOwnerId, claimerId, actorId } = args;
  if (actorId === itemOwnerId) return claimerId;
  if (actorId === claimerId) return itemOwnerId;
  throw new Error("Unauthorized");
}

function hasDateOverlap(
  a: { startDate: number; endDate: number },
  b: { startDate: number; endDate: number },
): boolean {
  return a.startDate < b.endDate && a.endDate > b.startDate;
}

function isRangeActiveNow(range: {
  startDate: number;
  endDate: number;
}): boolean {
  const now = Date.now();
  return range.startDate <= now && now <= range.endDate;
}

async function assertItemCanStartEarlyPickup(args: {
  ctx: MutationCtx;
  itemId: Id<"items">;
  claimId: Id<"claims">;
  ownerId: string;
  fromAt: number;
  scheduledStartAt: number;
}) {
  if (args.fromAt >= args.scheduledStartAt) return;

  const earlyWindow = {
    startDate: args.fromAt,
    endDate: args.scheduledStartAt,
  };

  const approvedClaims = await args.ctx.db
    .query("claims")
    .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
    .filter((q) => q.eq(q.field("status"), "approved"))
    .collect();

  const hasClaimConflict = approvedClaims.some(
    (otherClaim) =>
      otherClaim._id !== args.claimId &&
      !otherClaim.expiredAt &&
      !otherClaim.returnedAt &&
      !otherClaim.transferredAt &&
      hasDateOverlap(earlyWindow, {
        startDate: otherClaim.startDate,
        endDate: otherClaim.endDate,
      }),
  );

  if (hasClaimConflict) {
    throw new Error(
      "Cannot confirm early pickup while the item is reserved for another approved request",
    );
  }

  const ownerBlocks = await args.ctx.db
    .query("owner_unavailability")
    .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
    .collect();

  const hasOwnerBlockConflict = ownerBlocks.some((block) =>
    hasDateOverlap(earlyWindow, {
      startDate: block.startDate,
      endDate: block.endDate,
    }),
  );

  if (hasOwnerBlockConflict) {
    throw new Error(
      "Cannot confirm early pickup while the owner marked the item unavailable",
    );
  }
}

function getPendingClaimExpiresAt(range: {
  startDate: number;
  endDate: number;
}): number {
  const duration = range.endDate - range.startDate;
  const isHourAligned =
    range.startDate % ONE_HOUR_MS === 0 && range.endDate % ONE_HOUR_MS === 0;
  const isIntraday = duration < ONE_DAY_MS && isHourAligned;

  return isIntraday ? range.endDate : range.startDate + ONE_DAY_MS;
}

function assertHourAligned(windowStartAt: number): void {
  if (windowStartAt % ONE_HOUR_MS !== 0) {
    throw new Error("Time must be aligned to the hour");
  }
}

function normalizeItemId(ctx: QueryCtx, id: string): Id<"items"> | null {
  return ctx.db.normalizeId("items", id);
}

function cleanOptionalText(
  value: string | undefined,
  maxLength: number,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxLength) {
    throw new Error("Meetup details are too long");
  }
  return trimmed;
}

function formatMeetupSystemBody(args: {
  type: "Pickup" | "Return";
  action: "proposed" | "approved" | "requested";
  meetingAt?: number;
  place?: string;
  note?: string;
}): string {
  const details = [
    args.meetingAt ? `time ${new Date(args.meetingAt).toLocaleString()}` : null,
    args.place ? `at ${args.place}` : null,
    args.note ? `Note: ${args.note}` : null,
  ].filter(Boolean);

  return details.length > 0
    ? `${args.type} plan ${args.action}: ${details.join("; ")}`
    : `${args.type} plan ${args.action}.`;
}

function getLatestEvent(
  events: Doc<"lease_activity">[],
  type: Doc<"lease_activity">["type"],
): Doc<"lease_activity"> | undefined {
  return events.find((event) => event.type === type);
}

// Seed function for testing (no auth required)
export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if already seeded
    const existing = await ctx.db.query("items").first();
    if (existing) {
      return { message: "Already seeded", count: 0 };
    }

    const testOwnerId = "test-user-seed";

    const testItems = [
      {
        name: "Rice Cooker",
        description:
          "Electric rice cooker, 1.8L capacity. Perfect for 2-4 people.",
        category: "kitchen" as const,
        location: { lat: 11.9404, lng: 108.4583, address: "Da Lat Market" },
      },
      {
        name: "Camping Tent",
        description: "2-person waterproof tent. Great for weekend trips.",
        category: "sports" as const,
        location: { lat: 11.945, lng: 108.442, address: "Xuan Huong Lake" },
      },
      {
        name: "LED Desk Lamp",
        description: "Adjustable brightness LED lamp with USB charging port.",
        category: "electronics" as const,
        location: { lat: 11.938, lng: 108.455, address: "Da Lat University" },
      },
      {
        name: "Winter Jacket",
        description: "Warm fleece jacket, size M. Perfect for Da Lat evenings.",
        category: "clothing" as const,
        location: { lat: 11.942, lng: 108.461, address: "Hoa Binh Square" },
      },
      {
        name: "Vietnamese Cookbook",
        description: "Traditional recipes from Central Vietnam. 200+ recipes.",
        category: "books" as const,
        location: { lat: 11.936, lng: 108.448, address: "Crazy House" },
      },
      {
        name: "Folding Chair",
        description:
          "Portable folding chair for outdoor use. Lightweight aluminum.",
        category: "furniture" as const,
        location: { lat: 11.948, lng: 108.453, address: "Valley of Love" },
      },
      {
        name: "Yoga Mat",
        description: "Non-slip yoga mat, 6mm thick. Includes carrying strap.",
        category: "sports" as const,
        location: { lat: 11.934, lng: 108.462, address: "Langbiang Mountain" },
      },
      {
        name: "Bluetooth Speaker",
        description: "Portable waterproof speaker. 10 hour battery life.",
        category: "electronics" as const,
        location: { lat: 11.941, lng: 108.45, address: "Da Lat Night Market" },
      },
      {
        name: "Coffee Grinder",
        description: "Manual burr coffee grinder. Perfect for Da Lat coffee!",
        category: "kitchen" as const,
        location: { lat: 11.939, lng: 108.456, address: "Big C Da Lat" },
      },
      {
        name: "Board Games Set",
        description:
          "Collection of classic board games: Chess, Checkers, Backgammon.",
        category: "other" as const,
        location: {
          lat: 11.943,
          lng: 108.447,
          address: "Da Lat Railway Station",
        },
      },
    ];

    for (const item of testItems) {
      await ctx.db.insert("items", {
        name: item.name,
        description: item.description,
        searchText: buildItemSearchText({
          name: item.name,
          description: item.description,
        }),
        ownerId: testOwnerId,
        category: item.category,
        location: item.location,
      });
    }

    return { message: "Seeded successfully", count: testItems.length };
  },
});

export const get = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const items = await ctx.db.query("items").order("desc").collect();

    const activeUnavailableOwners = await getActiveUnavailableOwners(ctx);

    if (!identity) {
      return Promise.all(
        items
          .filter((item) => !activeUnavailableOwners.has(item.ownerId))
          .map((item) => resolvePublicItem({ ctx, item })),
      );
    }

    const myClaimedItemIds = await getActiveClaimedItemIds(
      ctx,
      identity.subject,
    );

    return Promise.all(
      items
        .filter((item) => !activeUnavailableOwners.has(item.ownerId))
        .map((item) =>
          resolvePublicItem({
            ctx,
            item,
            viewerId: identity.subject,
            claimedItemIds: myClaimedItemIds,
          }),
        ),
    );
  },
});

export const getByOwner = query({
  args: { ownerId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const claimedItemIds = identity
      ? await getActiveClaimedItemIds(ctx, identity.subject)
      : undefined;

    const items = await ctx.db
      .query("items")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .order("desc")
      .collect();

    return Promise.all(
      items.map((item) =>
        resolvePublicItem({
          ctx,
          item,
          viewerId: identity?.subject,
          claimedItemIds,
        }),
      ),
    );
  },
});

const itemCategoryArrayValidator = v.array(
  v.union(
    v.literal("kitchen"),
    v.literal("furniture"),
    v.literal("electronics"),
    v.literal("clothing"),
    v.literal("books"),
    v.literal("sports"),
    v.literal("other"),
  ),
);

async function getActiveUnavailableOwners(ctx: QueryCtx): Promise<Set<string>> {
  const activeUnavailableOwners = new Set<string>();
  const ownerBlocks = await ctx.db.query("owner_unavailability").collect();
  for (const block of ownerBlocks) {
    if (isRangeActiveNow(block)) {
      activeUnavailableOwners.add(block.ownerId);
    }
  }
  return activeUnavailableOwners;
}

async function searchOwnerIds(
  ctx: QueryCtx,
  queryText: string,
  limit: number,
): Promise<string[]> {
  const query = queryText.trim();
  if (!query) return [];

  const owners = await ctx.db
    .query("users")
    .withSearchIndex("search_public_users", (q) =>
      q.search("publicSearchText", query),
    )
    .take(limit);

  return owners.map((owner) => owner.clerkId);
}

function itemMatchesFilters(args: {
  item: Doc<"items">;
  queryText: string;
  categories: string[];
  giveawayOnly: boolean;
  hideMyItems: boolean;
  viewerId?: string;
  activeUnavailableOwners: Set<string>;
}): boolean {
  if (isInternalTestItem(args.item)) return false;
  if (args.activeUnavailableOwners.has(args.item.ownerId)) return false;
  if (args.hideMyItems && args.viewerId === args.item.ownerId) return false;
  if (args.giveawayOnly && !args.item.giveaway) return false;
  if (
    args.categories.length > 0 &&
    (!args.item.category || !args.categories.includes(args.item.category))
  ) {
    return false;
  }

  const queryText = args.queryText.trim().toLowerCase();
  if (!queryText) return true;

  const searchText =
    args.item.searchText ??
    buildItemSearchText({
      name: args.item.name,
      description: args.item.description,
    });
  return searchText.toLowerCase().includes(queryText);
}

export const searchDiscovery = query({
  args: {
    queryText: v.string(),
    ownerQueries: v.array(v.string()),
    selectedOwnerIds: v.array(v.string()),
    categories: itemCategoryArrayValidator,
    giveawayOnly: v.boolean(),
    hideMyItems: v.boolean(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const viewerId = identity?.subject;
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const queryText = args.queryText.trim();
    const activeUnavailableOwners = await getActiveUnavailableOwners(ctx);
    const claimedItemIds = viewerId
      ? await getActiveClaimedItemIds(ctx, viewerId)
      : undefined;

    const ownerIds = new Set(args.selectedOwnerIds);
    for (const ownerQuery of args.ownerQueries) {
      const matches = await searchOwnerIds(ctx, ownerQuery, 8);
      for (const ownerId of matches) ownerIds.add(ownerId);
    }

    let candidates: Doc<"items">[];

    if (ownerIds.size > 0) {
      const byOwner = await Promise.all(
        Array.from(ownerIds).map((ownerId) =>
          ctx.db
            .query("items")
            .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
            .order("desc")
            .collect(),
        ),
      );
      candidates = byOwner
        .flat()
        .sort((a, b) => b._creationTime - a._creationTime);
    } else if (queryText) {
      const indexedCandidates = await ctx.db
        .query("items")
        .withSearchIndex("search_items", (q) =>
          q.search("searchText", queryText),
        )
        .take(100);
      const legacyCandidates = await ctx.db
        .query("items")
        .filter((q) => q.eq(q.field("searchText"), undefined))
        .collect();
      candidates = [
        ...indexedCandidates,
        ...legacyCandidates.filter((item) =>
          itemMatchesFilters({
            item,
            queryText,
            categories: [],
            giveawayOnly: false,
            hideMyItems: false,
            viewerId,
            activeUnavailableOwners: new Set(),
          }),
        ),
      ];
    } else {
      candidates = await ctx.db.query("items").order("desc").collect();
    }

    const filtered = candidates
      .filter((item) =>
        itemMatchesFilters({
          item,
          queryText: ownerIds.size > 0 ? queryText : "",
          categories: args.categories,
          giveawayOnly: args.giveawayOnly,
          hideMyItems: args.hideMyItems,
          viewerId,
          activeUnavailableOwners,
        }),
      )
      .slice(0, limit);

    return resolveDiscoveryItems({
      ctx,
      items: filtered,
      viewerId,
      claimedItemIds,
    });
  },
});

export const getById = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const itemId = normalizeItemId(ctx, args.id);
    if (!itemId) return null;

    const identity = await ctx.auth.getUserIdentity();
    const item = await ctx.db.get(itemId);

    if (!item) return null;

    const { images, imageUrls } = await resolveImages({
      ctx,
      imageCloudinary: item.imageCloudinary,
      imageStorageIds: item.imageStorageIds,
    });

    const isOwner = identity?.subject === item.ownerId;

    let requests = undefined;
    if (isOwner) {
      requests = await ctx.db
        .query("claims")
        .withIndex("by_item", (q) => q.eq("itemId", itemId))
        .collect();
    }

    // Always fetch my claims for this item to support multiple requests
    const myClaims = await ctx.db
      .query("claims")
      .withIndex("by_claimer", (q) =>
        q.eq("claimerId", identity?.subject ?? ""),
      )
      .filter((q) => q.eq(q.field("itemId"), itemId))
      .collect();

    return {
      ...item,
      images,
      imageUrls,
      isOwner,
      requests,
      myClaims,
    };
  },
});

export const getOwnerUnavailability = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const rows = await ctx.db
      .query("owner_unavailability")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
      .collect();

    return rows.sort((a, b) => a.startDate - b.startDate);
  },
});

export const addOwnerUnavailabilityRange = mutation({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    if (args.endDate < args.startDate) {
      throw new Error("End date must be after start date");
    }

    await ctx.db.insert("owner_unavailability", {
      ownerId: identity.subject,
      startDate: args.startDate,
      endDate: args.endDate,
      note: args.note,
    });
  },
});

export const deleteOwnerUnavailabilityRange = mutation({
  args: { id: v.id("owner_unavailability") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Unavailability range not found");
    if (row.ownerId !== identity.subject) throw new Error("Unauthorized");

    await ctx.db.delete(args.id);
  },
});

export const getMyItems = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // 1. Get items owned by the user
    const ownedItems = await ctx.db
      .query("items")
      .filter((q) => q.eq(q.field("ownerId"), identity.subject))
      .order("desc")
      .collect();

    // 2. Get items borrowed by the user (approved claims)
    const myClaims = await ctx.db
      .query("claims")
      .withIndex("by_claimer", (q) => q.eq("claimerId", identity.subject))
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();

    const activeBorrowedClaims = myClaims.filter(
      (c) =>
        !!c.pickedUpAt &&
        !c.returnedAt &&
        !c.transferredAt &&
        !c.expiredAt &&
        !c.missingAt,
    );

    const borrowedItemIds = activeBorrowedClaims.map((c) => c.itemId);

    // Fetch the actual item documents for borrowed items
    const borrowedItems = [];
    for (const itemId of borrowedItemIds) {
      const item = await ctx.db.get(itemId);
      if (item) {
        borrowedItems.push(item);
      }
    }

    // 3. Combine and add isOwner flag
    const result = [
      ...ownedItems.map((item) => ({ ...item, isOwner: true })),
      ...borrowedItems.map((item) => ({ ...item, isOwner: false })),
    ];

    const resultWithUrls = await Promise.all(
      result.map(async (item) => {
        const { images, imageUrls } = await resolveImages({
          ctx,
          imageCloudinary: item.imageCloudinary,
          imageStorageIds: item.imageStorageIds,
        });

        return {
          ...item,
          images,
          imageUrls,
        };
      }),
    );

    return resultWithUrls;
  },
});

const categoryValidator = v.optional(
  v.union(
    v.literal("kitchen"),
    v.literal("furniture"),
    v.literal("electronics"),
    v.literal("clothing"),
    v.literal("books"),
    v.literal("sports"),
    v.literal("other"),
  ),
);

const locationValidator = v.optional(
  v.object({
    lat: v.number(),
    lng: v.number(),
    address: v.optional(v.string()),
    ward: v.optional(v.string()),
  }),
);

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    giveaway: v.optional(v.boolean()),
    minLeaseDays: v.optional(v.number()),
    maxLeaseDays: v.optional(v.number()),
    imageStorageIds: v.optional(v.array(v.id("_storage"))),
    imageCloudinary: v.optional(v.array(vCloudinaryRef)),
    category: categoryValidator,
    location: locationValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated call to mutation");
    }
    const ownerId = identity.subject;

    if ((args.imageStorageIds?.length ?? 0) > 0) {
      throw new Error("Convex storage images are disabled; use Cloudinary");
    }

    assertValidLeaseDaysLimits({
      giveaway: Boolean(args.giveaway),
      minLeaseDays: args.minLeaseDays,
      maxLeaseDays: args.maxLeaseDays,
    });

    const itemId = await ctx.db.insert("items", {
      name: args.name,
      description: args.description,
      searchText: buildItemSearchText({
        name: args.name,
        description: args.description,
      }),
      ownerId,
      giveaway: args.giveaway,
      minLeaseDays: args.minLeaseDays,
      maxLeaseDays: args.maxLeaseDays,
      imageStorageIds: undefined,
      imageCloudinary: args.imageCloudinary,
      category: args.category,
      location: args.location,
    });

    await ctx.db.insert("item_activity", {
      itemId,
      type: "item_created",
      actorId: ownerId,
      createdAt: Date.now(),
    });

    return itemId;
  },
});

export const update = mutation({
  args: {
    id: v.id("items"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    imageStorageIds: v.optional(v.array(v.id("_storage"))),
    imageCloudinary: v.optional(v.array(vCloudinaryRef)),
    category: categoryValidator,
    location: locationValidator,
    minLeaseDays: v.optional(v.number()),
    maxLeaseDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated call to mutation");
    }
    const { id, ...fields } = args;

    if ((fields.imageStorageIds?.length ?? 0) > 0) {
      throw new Error("Convex storage images are disabled; use Cloudinary");
    }
    if ("imageStorageIds" in fields) {
      fields.imageStorageIds = undefined;
    }

    const item = await ctx.db.get(id);
    if (!item) {
      throw new Error("Item not found");
    }

    if (item.ownerId !== identity.subject) {
      throw new Error("Unauthorized: You do not own this item");
    }

    assertValidLeaseDaysLimits({
      giveaway: Boolean(item.giveaway),
      minLeaseDays: fields.minLeaseDays ?? item.minLeaseDays,
      maxLeaseDays: fields.maxLeaseDays ?? item.maxLeaseDays,
    });

    await ctx.db.patch(id, {
      ...fields,
      searchText: buildItemSearchText({
        name: fields.name ?? item.name,
        description: fields.description ?? item.description,
      }),
    });
  },
});

export const switchItemMode = mutation({
  args: {
    id: v.id("items"),
    giveaway: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found");
    if (item.ownerId !== identity.subject) throw new Error("Unauthorized");

    const currentGiveaway = Boolean(item.giveaway);
    if (currentGiveaway === args.giveaway) {
      return { changed: false };
    }

    const claims = await ctx.db
      .query("claims")
      .withIndex("by_item", (q) => q.eq("itemId", args.id))
      .collect();

    const activeApproved = claims.filter((c) => {
      if (c.status !== "approved") return false;
      return !c.returnedAt && !c.transferredAt && !c.expiredAt && !c.missingAt;
    });

    if (activeApproved.length > 0) {
      const pickedUpNotClosed = activeApproved.some(
        (c) => !!c.pickedUpAt && !c.returnedAt && !c.transferredAt,
      );
      if (pickedUpNotClosed) {
        throw new Error(
          "cannot switch mode when item is already picked up & not returned",
        );
      }
      throw new Error(
        "Cannot switch mode while there is an active approved request",
      );
    }

    const now = Date.now();
    const pendingClaims = claims.filter((c) => c.status === "pending");
    for (const claim of pendingClaims) {
      await ctx.db.patch(claim._id, { status: "rejected", rejectedAt: now });

      await ctx.db.insert("lease_activity", {
        itemId: args.id,
        claimId: claim._id,
        type: "lease_rejected",
        actorId: identity.subject,
        createdAt: now,
        note: "Rejected due to item mode switch",
      });

      await ctx.db.insert("notifications", {
        recipientId: claim.claimerId,
        type: "request_rejected",
        itemId: args.id,
        requestId: claim._id,
        isRead: false,
        createdAt: now,
      });
    }

    await ctx.db.patch(args.id, { giveaway: args.giveaway });
    if (args.giveaway) {
      await ctx.db.patch(args.id, {
        minLeaseDays: undefined,
        maxLeaseDays: undefined,
      });
    }
    return { changed: true, rejectedCount: pendingClaims.length };
  },
});

export const deleteItem = mutation({
  args: { id: v.id("items") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated call to mutation");
    }

    const item = await ctx.db.get(args.id);
    if (!item) {
      throw new Error("Item not found");
    }

    if (item.ownerId !== identity.subject) {
      throw new Error("Unauthorized: You do not own this item");
    }

    await ctx.db.delete(args.id);
  },
});

export const requestItem = mutation({
  args: {
    id: v.id("items"),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found");
    if (item.ownerId === identity.subject)
      throw new Error("Cannot claim your own item");

    if (item.giveaway) {
      if (args.endDate !== args.startDate + ONE_DAY_MS) {
        throw new Error("Giveaway pickup date must be a single day");
      }
      // We intentionally don't validate "start of local day" here because
      // server timezones differ from user timezones (Convex often runs in UTC).
      // Hour alignment is enough to keep the data clean for calendar math.
      assertHourAligned(args.startDate);
    }

    const ownerBlocks = await ctx.db
      .query("owner_unavailability")
      .withIndex("by_owner", (q) => q.eq("ownerId", item.ownerId))
      .collect();
    const blocksOverlap = ownerBlocks.some((b) =>
      hasDateOverlap(
        { startDate: args.startDate, endDate: args.endDate },
        { startDate: b.startDate, endDate: b.endDate },
      ),
    );
    if (blocksOverlap) {
      throw new Error("Item is not available for these dates");
    }

    // Validate dates
    const now = Date.now();
    if (args.endDate <= args.startDate) {
      throw new Error("End date must be after start date");
    }

    const duration = args.endDate - args.startDate;
    if (!item.giveaway) {
      const durationDays = duration / ONE_DAY_MS;
      const minLeaseDays = item.minLeaseDays;
      const maxLeaseDays = item.maxLeaseDays;

      if (typeof minLeaseDays === "number" && durationDays < minLeaseDays) {
        throw new Error(`Lease must be at least ${minLeaseDays} day(s)`);
      }
      if (typeof maxLeaseDays === "number" && durationDays > maxLeaseDays) {
        throw new Error(`Lease must be at most ${maxLeaseDays} day(s)`);
      }
    }
    const isHourAligned =
      args.startDate % ONE_HOUR_MS === 0 && args.endDate % ONE_HOUR_MS === 0;
    const isIntraday = duration < ONE_DAY_MS && isHourAligned;

    if (duration < ONE_DAY_MS && !isHourAligned) {
      throw new Error("Time must be aligned to the hour");
    }

    if (item.giveaway) {
      // Giveaway requests represent a pickup day in the user's local timezone.
      // We can't reliably compute "today" on the server due to timezone mismatch.
      // Instead, allow the request as long as the requested day hasn't fully passed.
      if (args.endDate <= now) {
        throw new Error("Start date must be today or later");
      }
    } else if (!isIntraday) {
      // Non-intraday leases are selected as calendar days in the user's local
      // timezone. Avoid server-midnight comparisons (Convex often runs in UTC).
      //
      // We still enforce:
      // - the requested range hasn't fully passed (endDate must be in the future)
      // - the start isn't too far in the past (allows "today" across timezones)
      if (args.endDate <= now) {
        throw new Error("Start date must be today or later");
      }
      if (args.startDate < now - ONE_DAY_MS) {
        throw new Error("Start date must be today or later");
      }
    }

    if (isIntraday) {
      // For intraday (hour-based) requests, require that:
      // - the window hasn't fully passed yet (end must be in the future)
      // - the start hour is not earlier than the current hour
      //
      // This allows a request like 21:00–23:00 at 21:05, but disallows
      // 20:00–23:00 at 21:05.
      if (args.endDate <= now) {
        throw new Error("The requested time window must end in the future");
      }
      const currentHourStart = Math.floor(now / ONE_HOUR_MS) * ONE_HOUR_MS;
      if (args.startDate < currentHourStart) {
        throw new Error("The requested time window must start in the future");
      }
      assertHourAligned(args.startDate);
      assertHourAligned(args.endDate);
    }

    // Check for specific overlaps with APPROVED claims
    const approvedClaims = await ctx.db
      .query("claims")
      .withIndex("by_item", (q) => q.eq("itemId", args.id))
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();

    const activeApprovedClaims = approvedClaims.filter(
      (c) => !c.expiredAt && !c.returnedAt && !c.transferredAt,
    );

    const hasOverlap = activeApprovedClaims.some((claim) =>
      hasDateOverlap(
        { startDate: args.startDate, endDate: args.endDate },
        { startDate: claim.startDate, endDate: claim.endDate },
      ),
    );

    if (hasOverlap) {
      throw new Error("Item is not available for these dates");
    }

    // Check for self-overlap (User cannot have overlapping requests for the same item)
    // Only consider active requests (pending/approved). Ignore rejected/cancelled.
    const myActiveRequests = await ctx.db
      .query("claims")
      .withIndex("by_claimer", (q) => q.eq("claimerId", identity.subject))
      .filter((q) => q.eq(q.field("itemId"), args.id))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "approved"),
        ),
      )
      .collect();

    const myBlockingRequests = myActiveRequests.filter(
      (r) =>
        r.status === "pending" ||
        (r.status === "approved" &&
          !r.expiredAt &&
          !r.returnedAt &&
          !r.transferredAt),
    );

    const hasSelfOverlap = myBlockingRequests.some((req) =>
      hasDateOverlap(
        { startDate: args.startDate, endDate: args.endDate },
        { startDate: req.startDate, endDate: req.endDate },
      ),
    );

    if (hasSelfOverlap) {
      throw new Error(
        "You already have a request that overlaps with these dates",
      );
    }

    const pendingClaims = await ctx.db
      .query("claims")
      .withIndex("by_item", (q) => q.eq("itemId", args.id))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    if (pendingClaims.length >= 5) {
      throw new Error("Waitlist is full");
    }

    const claimId = await ctx.db.insert("claims", {
      itemId: args.id,
      claimerId: identity.subject,
      status: "pending",
      startDate: args.startDate,
      endDate: args.endDate,
    });

    await ctx.db.insert("lease_activity", {
      itemId: args.id,
      claimId,
      type: "lease_requested",
      actorId: identity.subject,
      createdAt: now,
    });

    // Notify owner
    await ctx.db.insert("notifications", {
      recipientId: item.ownerId,
      type: "new_request",
      itemId: args.id,
      requestId: claimId,
      isRead: false,
      createdAt: now,
    });

    // Email owner: new request
    const owner = await resolveUserEmail(ctx, item.ownerId, "requestItem");
    const borrowerProfile = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (owner) {
      await ctx.scheduler.runAfter(0, internal.emailSend.sendNewRequest, {
        claimId,
        ownerEmail: owner.email,
        locale: owner.profile.locale,
        data: {
          ownerName: owner.name,
          borrowerName: borrowerProfile?.name ?? "Someone",
          itemName: item.name,
          startDate: args.startDate,
          endDate: args.endDate,
          itemId: args.id,
        },
      });
    }

    // Open/ensure conversation for this claim and post system message
    const claimerName = borrowerProfile?.name ?? "Someone";
    const fmtDate = (ts: number) => new Date(ts).toISOString().slice(0, 10);
    const conversationId = await ctx.runMutation(
      internal.messaging.ensureConversationForClaim,
      { claimId },
    );
    await ctx.runMutation(internal.messaging.sendSystemMessage, {
      conversationId,
      body: `${claimerName} requested this item from ${fmtDate(args.startDate)} to ${fmtDate(args.endDate)}.`,
      systemEvent: "claim_requested",
    });

    // Date-based requests store the selected local day at local midnight.
    // Expiring exactly at startDate would immediately expire same-day requests.
    await ctx.scheduler.runAt(
      getPendingClaimExpiresAt(args),
      internal.items.expirePendingClaim,
      { claimId },
    );
  },
});

export const getClaims = query({
  args: { id: v.id("items") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const item = await ctx.db.get(args.id);
    if (!item) return [];

    if (item.ownerId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    return await ctx.db
      .query("claims")
      .withIndex("by_item", (q) => q.eq("itemId", args.id))
      .collect();
  },
});

export const approveClaim = mutation({
  args: { claimId: v.id("claims"), id: v.id("items") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found");
    if (item.ownerId !== identity.subject) throw new Error("Unauthorized");

    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found");
    if (claim.itemId !== args.id) throw new Error("Mismatch item/claim");

    const now = Date.now();
    await ctx.db.patch(args.claimId, { status: "approved" });

    await ctx.db.insert("item_activity", {
      itemId: args.id,
      type: "loan_started",
      actorId: identity.subject,
      createdAt: now,
      claimId: args.claimId,
      borrowerId: claim.claimerId,
      startDate: claim.startDate,
      endDate: claim.endDate,
    });

    await ctx.db.insert("lease_activity", {
      itemId: args.id,
      claimId: args.claimId,
      type: "lease_approved",
      actorId: identity.subject,
      createdAt: now,
    });

    // Notify claimer
    await ctx.db.insert("notifications", {
      recipientId: claim.claimerId,
      type: "request_approved",
      itemId: args.id,
      requestId: args.claimId,
      isRead: false,
      createdAt: now,
    });

    // Email borrower: lease approved
    const borrower = await resolveUserEmail(
      ctx,
      claim.claimerId,
      "approveClaim",
    );
    if (borrower) {
      await ctx.scheduler.runAfter(0, internal.emailSend.sendLeaseApproved, {
        claimId: args.claimId,
        borrowerEmail: borrower.email,
        locale: borrower.profile.locale,
        data: {
          borrowerName: borrower.name,
          itemName: item.name,
          startDate: claim.startDate,
          endDate: claim.endDate,
          claimId: args.claimId,
          itemId: args.id,
        },
      });
    }

    // Chat: system message for approval
    const approveConvId = await ctx.runMutation(
      internal.messaging.ensureConversationForClaim,
      { claimId: args.claimId },
    );
    const fmtDateApprove = (ts: number) =>
      new Date(ts).toISOString().slice(0, 10);
    await ctx.runMutation(internal.messaging.sendSystemMessage, {
      conversationId: approveConvId,
      body: `Request approved — pickup window: ${fmtDateApprove(claim.startDate)} to ${fmtDateApprove(claim.endDate)}.`,
      systemEvent: "claim_approved",
    });

    // We no longer set isAvailable to false globally, as it depends on dates.

    // Optionally reject others or leave them pending?
    // Usually once approved, others are implicitly rejected or on hold.
    // Let's leave them pending but they effectively can't get it unless this one is cancelled.
  },
});

export const getLeaseActivity = query({
  args: { claimId: v.optional(v.id("claims")) },
  handler: async (ctx, args) => {
    const claimId = args.claimId;
    if (!claimId) return [];

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const claim = await ctx.db.get(claimId);
    if (!claim) throw new Error("Claim not found");

    const item = await ctx.db.get(claim.itemId);
    if (!item) throw new Error("Item not found");

    const userId = identity.subject;
    if (userId !== item.ownerId && userId !== claim.claimerId) {
      throw new Error("Unauthorized");
    }

    const events = await ctx.db
      .query("lease_activity")
      .withIndex("by_claim_createdAt", (q) => q.eq("claimId", claimId))
      .order("desc")
      .take(50);

    const eventsWithPhotos = await Promise.all(
      events.map(async (event) => {
        const photoUrls = (event.photoCloudinary ?? []).map((p) => p.secureUrl);
        return { ...event, photoUrls };
      }),
    );

    return eventsWithPhotos;
  },
});

export const proposePickupWindow = mutation({
  args: {
    itemId: v.id("items"),
    claimId: v.id("claims"),
    windowStartAt: v.optional(v.number()),
    place: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const now = Date.now();
    const place = cleanOptionalText(args.place, 160);
    const note = cleanOptionalText(args.note, 240);
    if (args.windowStartAt === undefined) {
      throw new Error("Pickup date and time are required");
    }

    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found");
    if (claim.itemId !== args.itemId) throw new Error("Mismatch item/claim");
    if (claim.status !== "approved") {
      throw new Error("Only approved claims can propose pickup");
    }
    if (claim.pickedUpAt)
      throw new Error("Pickup already recorded for this lease");
    if (claim.expiredAt)
      throw new Error("Cannot propose pickup for an expired lease");
    if (claim.returnedAt) throw new Error("Cannot propose pickup after return");
    if (claim.missingAt)
      throw new Error("Cannot propose pickup for a missing item");

    const windowEndAt =
      args.windowStartAt !== undefined
        ? args.windowStartAt + ONE_HOUR_MS
        : undefined;
    if (args.windowStartAt !== undefined) {
      if (
        !windowEndAt ||
        windowEndAt <= now ||
        args.windowStartAt < now - MAX_PAST_WINDOW_TOLERANCE_MS
      ) {
        throw new Error("The pickup window must be in the future");
      }
    }

    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Item not found");

    const userId = identity.subject;
    if (userId !== item.ownerId && userId !== claim.claimerId) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db
      .query("lease_activity")
      .withIndex("by_claim_createdAt", (q) => q.eq("claimId", args.claimId))
      .order("desc")
      .take(50);

    if (existing.some((e) => e.type === "lease_picked_up")) {
      throw new Error("Pickup already recorded for this lease");
    }
    if (existing.some((e) => e.type === "lease_expired")) {
      throw new Error("Cannot propose pickup for an expired lease");
    }
    if (existing.some((e) => e.type === "lease_rejected")) {
      throw new Error("Cannot propose pickup for a rejected lease");
    }

    const proposalId = `${args.claimId}-${now}-${Math.random().toString(16).slice(2)}`;

    await ctx.db.insert("lease_activity", {
      itemId: args.itemId,
      claimId: args.claimId,
      type: "lease_pickup_proposed",
      actorId: userId,
      createdAt: now,
      note,
      place,
      proposalId,
      windowStartAt: args.windowStartAt,
      windowEndAt,
    });

    const pickupRecipientId = otherPartyId({
      itemOwnerId: item.ownerId,
      claimerId: claim.claimerId,
      actorId: userId,
    });

    await ctx.db.insert("notifications", {
      recipientId: pickupRecipientId,
      type: "pickup_proposed",
      itemId: args.itemId,
      requestId: args.claimId,
      windowStartAt: args.windowStartAt,
      windowEndAt,
      isRead: false,
      createdAt: now,
    });

    const pickupConvId = await ctx.runMutation(
      internal.messaging.ensureConversationForClaim,
      { claimId: args.claimId },
    );
    await ctx.runMutation(internal.messaging.sendSystemMessage, {
      conversationId: pickupConvId,
      body: formatMeetupSystemBody({
        type: "Pickup",
        action: "proposed",
        meetingAt: args.windowStartAt,
        place,
        note,
      }),
      systemEvent: "pickup_proposed",
      systemWindowStartAt: args.windowStartAt,
      systemWindowEndAt: windowEndAt,
      systemPlace: place,
      systemNote: note,
    });

    // Keep email quiet: pickup proposals live in chat/in-app notifications only.
  },
});

export const proposeReturnWindow = mutation({
  args: {
    itemId: v.id("items"),
    claimId: v.id("claims"),
    windowStartAt: v.optional(v.number()),
    place: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const now = Date.now();
    const place = cleanOptionalText(args.place, 160);
    const note = cleanOptionalText(args.note, 240);

    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found");
    if (claim.itemId !== args.itemId) throw new Error("Mismatch item/claim");
    if (claim.status !== "approved") {
      throw new Error("Only approved claims can propose return");
    }
    if (claim.returnedAt)
      throw new Error("Return already recorded for this lease");
    if (claim.expiredAt)
      throw new Error("Cannot propose return for an expired lease");
    if (claim.missingAt)
      throw new Error("Cannot propose return for a missing item");

    const windowEndAt =
      args.windowStartAt !== undefined
        ? args.windowStartAt + ONE_HOUR_MS
        : undefined;
    if (args.windowStartAt !== undefined) {
      if (
        !windowEndAt ||
        windowEndAt <= now ||
        args.windowStartAt < now - MAX_PAST_WINDOW_TOLERANCE_MS
      ) {
        throw new Error("The return window must be in the future");
      }
    }

    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Item not found");
    if (item.giveaway) {
      throw new Error("Return is not required for giveaway items");
    }

    const userId = identity.subject;
    if (userId !== item.ownerId && userId !== claim.claimerId) {
      throw new Error("Only lease participants can propose return");
    }

    const existing = await ctx.db
      .query("lease_activity")
      .withIndex("by_claim_createdAt", (q) => q.eq("claimId", args.claimId))
      .order("desc")
      .take(50);

    const hasPickup =
      claim.pickedUpAt !== undefined ||
      existing.some((e) => e.type === "lease_picked_up");
    if (!hasPickup) {
      throw new Error("Cannot propose return before pickup is recorded");
    }
    if (existing.some((e) => e.type === "lease_returned")) {
      throw new Error("Return already recorded for this lease");
    }
    if (existing.some((e) => e.type === "lease_missing")) {
      throw new Error("Cannot propose return for a missing item");
    }
    if (existing.some((e) => e.type === "lease_rejected")) {
      throw new Error("Cannot propose return for a rejected lease");
    }

    const proposalId = `${args.claimId}-${now}-${Math.random().toString(16).slice(2)}`;

    await ctx.db.insert("lease_activity", {
      itemId: args.itemId,
      claimId: args.claimId,
      type: "lease_return_proposed",
      actorId: userId,
      createdAt: now,
      note,
      place,
      proposalId,
      windowStartAt: args.windowStartAt,
      windowEndAt,
    });

    const returnRecipientId = otherPartyId({
      itemOwnerId: item.ownerId,
      claimerId: claim.claimerId,
      actorId: userId,
    });

    await ctx.db.insert("notifications", {
      recipientId: returnRecipientId,
      type: "return_proposed",
      itemId: args.itemId,
      requestId: args.claimId,
      windowStartAt: args.windowStartAt,
      windowEndAt,
      isRead: false,
      createdAt: now,
    });

    const returnConvId = await ctx.runMutation(
      internal.messaging.ensureConversationForClaim,
      { claimId: args.claimId },
    );
    await ctx.runMutation(internal.messaging.sendSystemMessage, {
      conversationId: returnConvId,
      body: formatMeetupSystemBody({
        type: "Return",
        action: args.windowStartAt === undefined ? "requested" : "proposed",
        meetingAt: args.windowStartAt,
        place,
        note,
      }),
      systemEvent: "return_proposed",
      systemWindowStartAt: args.windowStartAt,
      systemWindowEndAt: windowEndAt,
      systemPlace: place,
      systemNote: note,
    });

    // Email owner only for the milestone: borrower is ready to return.
    const returnRecipient = await resolveUserEmail(
      ctx,
      returnRecipientId,
      "proposeReturnWindow",
    );
    const returnProposerProfile = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    if (userId === claim.claimerId && returnRecipient) {
      await ctx.scheduler.runAfter(0, internal.emailSend.sendReturnRequested, {
        claimId: args.claimId,
        ownerEmail: returnRecipient.email,
        locale: returnRecipient.profile.locale,
        data: {
          ownerName: returnRecipient.name,
          borrowerName: returnProposerProfile?.name ?? "The borrower",
          itemName: item.name,
          itemId: args.itemId,
        },
      });
    }
  },
});

export const approvePickupWindow = mutation({
  args: {
    itemId: v.id("items"),
    claimId: v.id("claims"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const now = Date.now();
    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found");
    if (claim.itemId !== args.itemId) throw new Error("Mismatch item/claim");
    if (claim.status !== "approved") {
      throw new Error("Only approved claims can approve pickup time");
    }
    if (claim.pickedUpAt)
      throw new Error("Pickup already recorded for this lease");
    if (claim.expiredAt)
      throw new Error("Cannot approve pickup for an expired lease");

    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Item not found");

    const userId = identity.subject;
    if (userId !== item.ownerId && userId !== claim.claimerId) {
      throw new Error("Unauthorized");
    }

    const events = await ctx.db
      .query("lease_activity")
      .withIndex("by_claim_createdAt", (q) => q.eq("claimId", args.claimId))
      .order("desc")
      .take(50);

    const latestProposal = events.find(
      (e) => e.type === "lease_pickup_proposed",
    );
    if (!latestProposal) {
      throw new Error("Pickup time must be proposed before it can be approved");
    }
    if (
      typeof latestProposal.windowEndAt === "number" &&
      now > latestProposal.windowEndAt
    ) {
      throw new Error("Pickup proposal has expired");
    }
    if (latestProposal.actorId === userId) {
      throw new Error("Only the counterparty can approve pickup time");
    }

    const latestApproval = events.find(
      (e) => e.type === "lease_pickup_approved",
    );
    if (
      latestApproval?.proposalId &&
      latestApproval.proposalId === latestProposal.proposalId
    ) {
      throw new Error("Pickup time already approved");
    }

    await ctx.db.insert("lease_activity", {
      itemId: args.itemId,
      claimId: args.claimId,
      type: "lease_pickup_approved",
      actorId: userId,
      createdAt: now,
      note: latestProposal.note,
      place: latestProposal.place,
      proposalId: latestProposal.proposalId,
      windowStartAt: latestProposal.windowStartAt,
      windowEndAt: latestProposal.windowEndAt,
    });

    await ctx.db.insert("notifications", {
      recipientId: latestProposal.actorId,
      type: "pickup_approved",
      itemId: args.itemId,
      requestId: args.claimId,
      windowStartAt: latestProposal.windowStartAt,
      windowEndAt: latestProposal.windowEndAt,
      isRead: false,
      createdAt: now,
    });

    const pickupConvId = await ctx.runMutation(
      internal.messaging.ensureConversationForClaim,
      { claimId: args.claimId },
    );
    await ctx.runMutation(internal.messaging.sendSystemMessage, {
      conversationId: pickupConvId,
      body: formatMeetupSystemBody({
        type: "Pickup",
        action: "approved",
        meetingAt: latestProposal.windowStartAt,
        place: latestProposal.place,
        note: latestProposal.note,
      }),
      systemEvent: "pickup_approved",
      systemWindowStartAt: latestProposal.windowStartAt,
      systemWindowEndAt: latestProposal.windowEndAt,
      systemPlace: latestProposal.place,
      systemNote: latestProposal.note,
    });

    // Email both parties: pickup meetup confirmed
    const [proposer, approver] = await Promise.all([
      resolveUserEmail(
        ctx,
        latestProposal.actorId,
        "approvePickupWindow/proposer",
      ),
      resolveUserEmail(ctx, userId, "approvePickupWindow/approver"),
    ]);
    if (
      proposer &&
      approver &&
      typeof latestProposal.windowStartAt === "number" &&
      typeof latestProposal.windowEndAt === "number"
    ) {
      await ctx.scheduler.runAfter(0, internal.emailSend.sendMeetupConfirmed, {
        claimId: args.claimId,
        meetupType: "pickup",
        recipient1Email: proposer.email,
        recipient2Email: approver.email,
        locale1: proposer.profile.locale,
        locale2: approver.profile.locale,
        data1: {
          recipientName: proposer.name,
          counterpartyName: approver.name,
          counterpartyContacts: approver.profile.contacts ?? {},
          itemName: item.name,
          windowStartAt: latestProposal.windowStartAt,
          windowEndAt: latestProposal.windowEndAt,
          itemId: args.itemId,
          meetupType: "pickup" as const,
        },
        data2: {
          recipientName: approver.name,
          counterpartyName: proposer.name,
          counterpartyContacts: proposer.profile.contacts ?? {},
          itemName: item.name,
          windowStartAt: latestProposal.windowStartAt,
          windowEndAt: latestProposal.windowEndAt,
          itemId: args.itemId,
          meetupType: "pickup" as const,
        },
      });
    }
  },
});

export const approveReturnWindow = mutation({
  args: {
    itemId: v.id("items"),
    claimId: v.id("claims"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const now = Date.now();
    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found");
    if (claim.itemId !== args.itemId) throw new Error("Mismatch item/claim");
    if (claim.status !== "approved") {
      throw new Error("Only approved claims can approve return time");
    }
    if (claim.returnedAt)
      throw new Error("Return already recorded for this lease");
    if (claim.expiredAt)
      throw new Error("Cannot approve return for an expired lease");
    if (claim.missingAt)
      throw new Error("Cannot approve return for a missing item");

    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Item not found");
    if (item.giveaway) {
      throw new Error("Return is not required for giveaway items");
    }

    const userId = identity.subject;
    if (userId !== item.ownerId && userId !== claim.claimerId) {
      throw new Error("Only lease participants can approve return time");
    }

    const events = await ctx.db
      .query("lease_activity")
      .withIndex("by_claim_createdAt", (q) => q.eq("claimId", args.claimId))
      .order("desc")
      .take(50);

    const hasPickup =
      claim.pickedUpAt !== undefined ||
      events.some((e) => e.type === "lease_picked_up");
    if (!hasPickup) {
      throw new Error("Cannot approve return before pickup is recorded");
    }

    const latestProposal = events.find(
      (e) => e.type === "lease_return_proposed",
    );
    if (!latestProposal) {
      throw new Error("Return time must be proposed before it can be approved");
    }
    if (typeof latestProposal.windowStartAt !== "number") {
      throw new Error("Return meeting time must be set before approval");
    }
    if (
      typeof latestProposal.windowEndAt === "number" &&
      now > latestProposal.windowEndAt
    ) {
      throw new Error("Return proposal has expired");
    }
    if (latestProposal.actorId === userId) {
      throw new Error("Only the counterparty can approve return time");
    }

    const latestApproval = events.find(
      (e) => e.type === "lease_return_approved",
    );
    if (
      latestApproval?.proposalId &&
      latestApproval.proposalId === latestProposal.proposalId
    ) {
      throw new Error("Return time already approved");
    }

    await ctx.db.insert("lease_activity", {
      itemId: args.itemId,
      claimId: args.claimId,
      type: "lease_return_approved",
      actorId: userId,
      createdAt: now,
      note: latestProposal.note,
      place: latestProposal.place,
      proposalId: latestProposal.proposalId,
      windowStartAt: latestProposal.windowStartAt,
      windowEndAt: latestProposal.windowEndAt,
    });

    await ctx.db.insert("notifications", {
      recipientId: latestProposal.actorId,
      type: "return_approved",
      itemId: args.itemId,
      requestId: args.claimId,
      windowStartAt: latestProposal.windowStartAt,
      windowEndAt: latestProposal.windowEndAt,
      isRead: false,
      createdAt: now,
    });

    const returnConvId = await ctx.runMutation(
      internal.messaging.ensureConversationForClaim,
      { claimId: args.claimId },
    );
    await ctx.runMutation(internal.messaging.sendSystemMessage, {
      conversationId: returnConvId,
      body: formatMeetupSystemBody({
        type: "Return",
        action: "approved",
        meetingAt: latestProposal.windowStartAt,
        place: latestProposal.place,
        note: latestProposal.note,
      }),
      systemEvent: "return_approved",
      systemWindowStartAt: latestProposal.windowStartAt,
      systemWindowEndAt: latestProposal.windowEndAt,
      systemPlace: latestProposal.place,
      systemNote: latestProposal.note,
    });

    // Email both parties: return meetup confirmed
    const [proposer, approver] = await Promise.all([
      resolveUserEmail(
        ctx,
        latestProposal.actorId,
        "approveReturnWindow/proposer",
      ),
      resolveUserEmail(ctx, userId, "approveReturnWindow/approver"),
    ]);
    if (
      proposer &&
      approver &&
      typeof latestProposal.windowStartAt === "number" &&
      typeof latestProposal.windowEndAt === "number"
    ) {
      await ctx.scheduler.runAfter(0, internal.emailSend.sendMeetupConfirmed, {
        claimId: args.claimId,
        meetupType: "return",
        recipient1Email: proposer.email,
        recipient2Email: approver.email,
        locale1: proposer.profile.locale,
        locale2: approver.profile.locale,
        data1: {
          recipientName: proposer.name,
          counterpartyName: approver.name,
          counterpartyContacts: approver.profile.contacts ?? {},
          itemName: item.name,
          windowStartAt: latestProposal.windowStartAt,
          windowEndAt: latestProposal.windowEndAt,
          itemId: args.itemId,
          meetupType: "return" as const,
        },
        data2: {
          recipientName: approver.name,
          counterpartyName: proposer.name,
          counterpartyContacts: proposer.profile.contacts ?? {},
          itemName: item.name,
          windowStartAt: latestProposal.windowStartAt,
          windowEndAt: latestProposal.windowEndAt,
          itemId: args.itemId,
          meetupType: "return" as const,
        },
      });
    }
  },
});

export const markPickedUp = mutation({
  args: {
    itemId: v.id("items"),
    claimId: v.id("claims"),
    note: v.optional(v.string()),
    photoStorageIds: v.optional(v.array(v.id("_storage"))),
    photoCloudinary: v.optional(v.array(vCloudinaryRef)),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    if ((args.photoStorageIds?.length ?? 0) > 0) {
      throw new Error("Convex storage photos are disabled; use Cloudinary");
    }

    const createdAt = Date.now();
    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found");
    if (claim.itemId !== args.itemId) throw new Error("Mismatch item/claim");
    if (claim.status !== "approved") {
      throw new Error("Only approved claims can be marked as picked up");
    }
    if (claim.pickedUpAt) {
      throw new Error("Pickup already recorded for this lease");
    }
    if (claim.expiredAt) {
      throw new Error("Cannot confirm pickup for an expired lease");
    }

    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Item not found");

    const itemOwnerIdAtPickup = item.ownerId;

    const userId = identity.subject;
    const existing = await ctx.db
      .query("lease_activity")
      .withIndex("by_claim_createdAt", (q) => q.eq("claimId", args.claimId))
      .order("desc")
      .take(50);

    if (existing.some((e) => e.type === "lease_picked_up")) {
      throw new Error("Pickup already recorded for this lease");
    }
    if (existing.some((e) => e.type === "lease_expired")) {
      throw new Error("Cannot confirm pickup for an expired lease");
    }
    if (existing.some((e) => e.type === "lease_rejected")) {
      throw new Error("Cannot confirm pickup for a rejected lease");
    }

    const latestProposal = getLatestEvent(existing, "lease_pickup_proposed");
    const latestApproval = getLatestEvent(existing, "lease_pickup_approved");
    const confirmedPlan =
      latestApproval?.proposalId &&
      latestApproval.proposalId === latestProposal?.proposalId
        ? latestApproval
        : latestProposal;

    if (userId !== claim.claimerId) {
      throw new Error("Only the borrower can confirm receiving the item");
    }

    await assertItemCanStartEarlyPickup({
      ctx,
      itemId: args.itemId,
      claimId: args.claimId,
      ownerId: item.ownerId,
      fromAt: createdAt,
      scheduledStartAt: claim.startDate,
    });

    await ctx.db.insert("lease_activity", {
      itemId: args.itemId,
      claimId: args.claimId,
      type: "lease_picked_up",
      actorId: userId,
      createdAt,
      note: args.note,
      photoStorageIds: undefined,
      photoCloudinary: args.photoCloudinary,
      proposalId: confirmedPlan?.proposalId,
      windowStartAt: confirmedPlan?.windowStartAt,
      windowEndAt: confirmedPlan?.windowEndAt,
    });

    await ctx.db.insert("item_activity", {
      itemId: args.itemId,
      type: "item_picked_up",
      actorId: userId,
      createdAt,
      claimId: args.claimId,
      borrowerId: claim.claimerId,
    });

    await ctx.db.patch(args.claimId, { pickedUpAt: createdAt });

    if (item.giveaway) {
      await ctx.db.insert("lease_activity", {
        itemId: args.itemId,
        claimId: args.claimId,
        type: "lease_transferred",
        actorId: userId,
        createdAt,
        note: args.note,
        photoStorageIds: undefined,
        photoCloudinary: args.photoCloudinary,
        proposalId: confirmedPlan?.proposalId,
        windowStartAt: confirmedPlan?.windowStartAt,
        windowEndAt: confirmedPlan?.windowEndAt,
      });

      await ctx.db.patch(args.claimId, { transferredAt: createdAt });
      await ctx.db.patch(args.itemId, { ownerId: claim.claimerId });
    }

    await ctx.db.insert("notifications", {
      recipientId: otherPartyId({
        itemOwnerId: itemOwnerIdAtPickup,
        claimerId: claim.claimerId,
        actorId: userId,
      }),
      type: "pickup_confirmed",
      itemId: args.itemId,
      requestId: args.claimId,
      isRead: false,
      createdAt,
    });

    // For giveaway items, notify both parties to rate each other after transfer
    if (item.giveaway) {
      await ctx.db.insert("notifications", {
        recipientId: itemOwnerIdAtPickup,
        type: "rate_transaction",
        itemId: args.itemId,
        requestId: args.claimId,
        isRead: false,
        createdAt,
      });

      await ctx.db.insert("notifications", {
        recipientId: claim.claimerId,
        type: "rate_transaction",
        itemId: args.itemId,
        requestId: args.claimId,
        isRead: false,
        createdAt,
      });
    }

    // Chat: system message for pickup
    const pickupConvId = await ctx.runMutation(
      internal.messaging.ensureConversationForClaim,
      { claimId: args.claimId },
    );
    await ctx.runMutation(internal.messaging.sendSystemMessage, {
      conversationId: pickupConvId,
      body: "Item received. The borrower is now responsible for it.",
      systemEvent: "picked_up",
    });

    const owner = await resolveUserEmail(
      ctx,
      itemOwnerIdAtPickup,
      "markPickedUp",
    );
    const borrowerProfile = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", claim.claimerId))
      .first();
    if (owner && !item.giveaway) {
      await ctx.scheduler.runAfter(0, internal.emailSend.sendItemReceived, {
        claimId: args.claimId,
        ownerEmail: owner.email,
        locale: owner.profile.locale,
        data: {
          ownerName: owner.name,
          borrowerName: borrowerProfile?.name ?? "The borrower",
          itemName: item.name,
          expectedReturnAt: claim.endDate,
          itemId: args.itemId,
        },
      });
    }
  },
});

export const markReturned = mutation({
  args: {
    itemId: v.id("items"),
    claimId: v.id("claims"),
    note: v.optional(v.string()),
    photoStorageIds: v.optional(v.array(v.id("_storage"))),
    photoCloudinary: v.optional(v.array(vCloudinaryRef)),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    if ((args.photoStorageIds?.length ?? 0) > 0) {
      throw new Error("Convex storage photos are disabled; use Cloudinary");
    }

    const createdAt = Date.now();
    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found");
    if (claim.itemId !== args.itemId) throw new Error("Mismatch item/claim");
    if (claim.status !== "approved") {
      throw new Error("Only approved claims can be marked as returned");
    }
    if (claim.returnedAt) {
      throw new Error("Return already recorded for this lease");
    }
    if (claim.expiredAt) {
      throw new Error("Cannot confirm return for an expired lease");
    }
    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Item not found");
    if (item.giveaway) {
      throw new Error("Return is not required for giveaway items");
    }

    const userId = identity.subject;
    if (userId !== item.ownerId) {
      throw new Error("Only the owner can confirm the item was returned");
    }

    const existing = await ctx.db
      .query("lease_activity")
      .withIndex("by_claim_createdAt", (q) => q.eq("claimId", args.claimId))
      .order("desc")
      .take(50);

    if (existing.some((e) => e.type === "lease_returned")) {
      throw new Error("Return already recorded for this lease");
    }

    const hasPickup =
      claim.pickedUpAt !== undefined ||
      existing.some((e) => e.type === "lease_picked_up");
    if (!hasPickup) {
      throw new Error("Cannot mark returned before pickup is recorded");
    }
    if (existing.some((e) => e.type === "lease_rejected")) {
      throw new Error("Cannot confirm return for a rejected lease");
    }

    const latestProposal = getLatestEvent(existing, "lease_return_proposed");
    if (!latestProposal) {
      throw new Error("Borrower must request return before owner confirms it");
    }
    const latestApproval = getLatestEvent(existing, "lease_return_approved");
    const confirmedPlan =
      latestApproval?.proposalId &&
      latestApproval.proposalId === latestProposal?.proposalId
        ? latestApproval
        : latestProposal;

    await ctx.db.insert("lease_activity", {
      itemId: args.itemId,
      claimId: args.claimId,
      type: "lease_returned",
      actorId: userId,
      createdAt,
      note: args.note,
      photoStorageIds: undefined,
      photoCloudinary: args.photoCloudinary,
      proposalId: confirmedPlan?.proposalId,
      windowStartAt: confirmedPlan?.windowStartAt,
      windowEndAt: confirmedPlan?.windowEndAt,
    });

    await ctx.db.insert("item_activity", {
      itemId: args.itemId,
      type: "item_returned",
      actorId: userId,
      createdAt,
      claimId: args.claimId,
      borrowerId: claim.claimerId,
    });

    await ctx.db.patch(args.claimId, { returnedAt: createdAt });

    await ctx.db.insert("notifications", {
      recipientId: otherPartyId({
        itemOwnerId: item.ownerId,
        claimerId: claim.claimerId,
        actorId: userId,
      }),
      type: "return_confirmed",
      itemId: args.itemId,
      requestId: args.claimId,
      isRead: false,
      createdAt,
    });

    // Notify both parties to rate each other
    await ctx.db.insert("notifications", {
      recipientId: item.ownerId,
      type: "rate_transaction",
      itemId: args.itemId,
      requestId: args.claimId,
      isRead: false,
      createdAt,
    });

    await ctx.db.insert("notifications", {
      recipientId: claim.claimerId,
      type: "rate_transaction",
      itemId: args.itemId,
      requestId: args.claimId,
      isRead: false,
      createdAt,
    });

    // Chat: system message for return
    const returnConvId = await ctx.runMutation(
      internal.messaging.ensureConversationForClaim,
      { claimId: args.claimId },
    );
    await ctx.runMutation(internal.messaging.sendSystemMessage, {
      conversationId: returnConvId,
      body: "Item returned. Responsibility is back with the owner.",
      systemEvent: "returned",
    });

    const borrower = await resolveUserEmail(
      ctx,
      claim.claimerId,
      "markReturned/borrower",
    );
    if (borrower) {
      await ctx.scheduler.runAfter(0, internal.emailSend.sendItemReturned, {
        claimId: args.claimId,
        borrowerEmail: borrower.email,
        locale: borrower.profile.locale,
        data: {
          borrowerName: borrower.name,
          itemName: item.name,
          itemId: args.itemId,
        },
      });
    }

    const subscriptions = await ctx.db
      .query("availability_alerts")
      .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
      .collect();

    for (const sub of subscriptions) {
      if (sub.userId === item.ownerId || sub.userId === claim.claimerId) {
        await ctx.db.delete(sub._id);
        continue;
      }

      await ctx.db.insert("notifications", {
        recipientId: sub.userId,
        type: "item_available",
        itemId: args.itemId,
        isRead: false,
        createdAt,
      });

      const subscriber = await resolveUserEmail(
        ctx,
        sub.userId,
        "markReturned/itemAvailable",
      );
      if (subscriber) {
        await ctx.scheduler.runAfter(0, internal.emailSend.sendItemAvailable, {
          itemId: args.itemId,
          recipientClerkId: sub.userId,
          recipientEmail: subscriber.email,
          locale: subscriber.profile.locale,
          data: {
            recipientName: subscriber.name,
            itemName: item.name,
            itemId: args.itemId,
          },
        });
      }

      await ctx.db.delete(sub._id);
    }
  },
});

export const rejectClaim = mutation({
  args: { claimId: v.id("claims"), id: v.id("items") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found");
    if (item.ownerId !== identity.subject) throw new Error("Unauthorized");

    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found");

    const now = Date.now();
    await ctx.db.patch(args.claimId, { status: "rejected" });

    await ctx.db.insert("lease_activity", {
      itemId: args.id,
      claimId: args.claimId,
      type: "lease_rejected",
      actorId: identity.subject,
      createdAt: now,
    });

    // Notify claimer
    await ctx.db.insert("notifications", {
      recipientId: claim.claimerId,
      type: "request_rejected",
      itemId: args.id,
      requestId: args.claimId,
      isRead: false,
      createdAt: now,
    });

    // Email borrower: request rejected
    const borrower = await resolveUserEmail(
      ctx,
      claim.claimerId,
      "rejectClaim",
    );
    if (borrower) {
      await ctx.scheduler.runAfter(0, internal.emailSend.sendRequestRejected, {
        claimId: args.claimId,
        borrowerEmail: borrower.email,
        locale: borrower.profile.locale,
        data: {
          borrowerName: borrower.name,
          itemName: item.name,
          startDate: claim.startDate,
          endDate: claim.endDate,
        },
      });
    }

    // Chat: system message for rejection
    const rejectConvId = await ctx.runMutation(
      internal.messaging.ensureConversationForClaim,
      { claimId: args.claimId },
    );
    await ctx.runMutation(internal.messaging.sendSystemMessage, {
      conversationId: rejectConvId,
      body: "Request declined.",
      systemEvent: "claim_rejected",
    });
  },
});

export const markExpired = mutation({
  args: {
    itemId: v.id("items"),
    claimId: v.id("claims"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found");
    if (claim.itemId !== args.itemId) throw new Error("Mismatch item/claim");
    if (claim.status !== "approved") {
      throw new Error("Only approved claims can be marked as expired");
    }
    if (claim.expiredAt) {
      throw new Error("Expired already recorded for this lease");
    }

    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Item not found");
    if (item.ownerId !== identity.subject) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("lease_activity")
      .withIndex("by_claim_createdAt", (q) => q.eq("claimId", args.claimId))
      .order("desc")
      .take(50);

    if (existing.some((e) => e.type === "lease_picked_up")) {
      throw new Error("Cannot mark expired after pickup is recorded");
    }
    if (existing.some((e) => e.type === "lease_expired")) {
      throw new Error("Expired already recorded for this lease");
    }

    const now = Date.now();
    await ctx.db.insert("lease_activity", {
      itemId: args.itemId,
      claimId: args.claimId,
      type: "lease_expired",
      actorId: identity.subject,
      createdAt: now,
      note: args.note,
    });

    await ctx.db.patch(args.claimId, { expiredAt: now });

    const recipientIds = [item.ownerId, claim.claimerId];
    for (const recipientId of recipientIds) {
      await ctx.db.insert("notifications", {
        recipientId,
        type: "pickup_expired",
        itemId: args.itemId,
        requestId: args.claimId,
        isRead: false,
        createdAt: now,
      });
    }

    // Email both parties: lease expired (pickup never happened)
    const [owner, borrowerResolved] = await Promise.all([
      resolveUserEmail(ctx, item.ownerId, "markExpired/owner"),
      resolveUserEmail(ctx, claim.claimerId, "markExpired/borrower"),
    ]);
    if (owner && borrowerResolved) {
      await ctx.scheduler.runAfter(0, internal.emailSend.sendOverdueAlert, {
        claimId: args.claimId,
        alertType: "expired",
        ownerEmail: owner.email,
        borrowerEmail: borrowerResolved.email,
        ownerLocale: owner.profile.locale,
        borrowerLocale: borrowerResolved.profile.locale,
        ownerData: {
          recipientName: owner.name,
          itemName: item.name,
          originalEndDate: claim.startDate,
          counterpartyName: borrowerResolved.name,
          counterpartyContacts: borrowerResolved.profile.contacts ?? {},
          itemId: args.itemId,
          role: "owner" as const,
        },
        borrowerData: {
          recipientName: borrowerResolved.name,
          itemName: item.name,
          originalEndDate: claim.startDate,
          counterpartyName: owner.name,
          counterpartyContacts: owner.profile.contacts ?? {},
          itemId: args.itemId,
          role: "borrower" as const,
        },
      });
    }
  },
});

export const markMissing = mutation({
  args: {
    itemId: v.id("items"),
    claimId: v.id("claims"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found");
    if (claim.itemId !== args.itemId) throw new Error("Mismatch item/claim");
    if (claim.status !== "approved") {
      throw new Error("Only approved claims can be marked as missing");
    }
    if (claim.missingAt) {
      throw new Error("Missing already recorded for this lease");
    }

    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Item not found");
    if (item.giveaway) {
      throw new Error("Missing returns are not tracked for giveaway items");
    }
    if (item.ownerId !== identity.subject) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("lease_activity")
      .withIndex("by_claim_createdAt", (q) => q.eq("claimId", args.claimId))
      .order("desc")
      .take(50);

    if (!existing.some((e) => e.type === "lease_picked_up")) {
      throw new Error("Cannot mark missing before pickup is recorded");
    }
    if (existing.some((e) => e.type === "lease_returned")) {
      throw new Error("Cannot mark missing after return is recorded");
    }
    if (existing.some((e) => e.type === "lease_missing")) {
      throw new Error("Missing already recorded for this lease");
    }

    const now = Date.now();
    await ctx.db.insert("lease_activity", {
      itemId: args.itemId,
      claimId: args.claimId,
      type: "lease_missing",
      actorId: identity.subject,
      createdAt: now,
      note: args.note,
    });

    await ctx.db.patch(args.claimId, { missingAt: now });

    const recipientIds = [item.ownerId, claim.claimerId];
    for (const recipientId of recipientIds) {
      await ctx.db.insert("notifications", {
        recipientId,
        type: "return_missing",
        itemId: args.itemId,
        requestId: args.claimId,
        isRead: false,
        createdAt: now,
      });
    }

    // Email both parties: item missing (never returned)
    const [owner, borrowerResolved] = await Promise.all([
      resolveUserEmail(ctx, item.ownerId, "markMissing/owner"),
      resolveUserEmail(ctx, claim.claimerId, "markMissing/borrower"),
    ]);
    if (owner && borrowerResolved) {
      await ctx.scheduler.runAfter(0, internal.emailSend.sendOverdueAlert, {
        claimId: args.claimId,
        alertType: "missing",
        ownerEmail: owner.email,
        borrowerEmail: borrowerResolved.email,
        ownerLocale: owner.profile.locale,
        borrowerLocale: borrowerResolved.profile.locale,
        ownerData: {
          recipientName: owner.name,
          itemName: item.name,
          originalEndDate: claim.endDate,
          counterpartyName: borrowerResolved.name,
          counterpartyContacts: borrowerResolved.profile.contacts ?? {},
          itemId: args.itemId,
          role: "owner" as const,
        },
        borrowerData: {
          recipientName: borrowerResolved.name,
          itemName: item.name,
          originalEndDate: claim.endDate,
          counterpartyName: owner.name,
          counterpartyContacts: owner.profile.contacts ?? {},
          itemId: args.itemId,
          role: "borrower" as const,
        },
      });
    }
  },
});

export const cancelClaim = mutation({
  args: { claimId: v.id("claims"), itemId: v.optional(v.id("items")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found");

    if (claim.claimerId !== identity.subject) {
      throw new Error("Unauthorized: You cannot cancel this claim");
    }

    // Keep behavior: we still delete cancelled claims for now.
    // Once we add a dedicated lease page, we can switch to a soft-cancel.
    await ctx.db.delete(claim._id);

    if (claim.status === "approved") {
      // Notify subscribers that item is available
      const subscriptions = await ctx.db
        .query("availability_alerts")
        .withIndex("by_item", (q) => q.eq("itemId", claim.itemId))
        .collect();

      const item = await ctx.db.get(claim.itemId);
      const availableItemName = item?.name ?? "Unknown item";

      for (const sub of subscriptions) {
        await ctx.db.insert("notifications", {
          recipientId: sub.userId,
          type: "item_available",
          itemId: claim.itemId,
          isRead: false,
          createdAt: Date.now(),
        });

        // Email subscriber: item available
        const subscriber = await resolveUserEmail(
          ctx,
          sub.userId,
          "cancelClaim/itemAvailable",
        );
        if (subscriber) {
          await ctx.scheduler.runAfter(
            0,
            internal.emailSend.sendItemAvailable,
            {
              itemId: claim.itemId,
              recipientClerkId: sub.userId,
              recipientEmail: subscriber.email,
              locale: subscriber.profile.locale,
              data: {
                recipientName: subscriber.name,
                itemName: availableItemName,
                itemId: claim.itemId,
              },
            },
          );
        }

        // Remove subscription after notifying
        await ctx.db.delete(sub._id);
      }
    }
  },
});

export const getAvailability = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const itemId = normalizeItemId(ctx, args.id);
    if (!itemId) return [];

    const item = await ctx.db.get(itemId);
    if (!item) return [];

    const claims = await ctx.db
      .query("claims")
      .withIndex("by_item", (q) => q.eq("itemId", itemId))
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();

    const activeClaims = claims.filter(
      (c) => !c.expiredAt && !c.returnedAt && !c.transferredAt,
    );

    const ownerBlocks = await ctx.db
      .query("owner_unavailability")
      .withIndex("by_owner", (q) => q.eq("ownerId", item.ownerId))
      .collect();

    return [
      ...activeClaims.map((c) => ({
        startDate: c.startDate,
        endDate: c.endDate,
        kind: c.missingAt ? "missing" : "booking",
      })),
      ...ownerBlocks.map((b) => ({
        startDate: b.startDate,
        endDate: b.endDate,
        kind: "owner_unavailable",
      })),
    ];
  },
});

export const getMyRequests = query({
  args: { itemId: v.string() },
  handler: async (ctx, args) => {
    const itemId = normalizeItemId(ctx, args.itemId);
    if (!itemId) return [];

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.db
      .query("claims")
      .withIndex("by_claimer", (q) => q.eq("claimerId", identity.subject))
      .filter((q) => q.eq(q.field("itemId"), itemId))
      .collect();
  },
});

export const getItemActivity = query({
  args: { itemId: v.string() },
  handler: async (ctx, args) => {
    const itemId = normalizeItemId(ctx, args.itemId);
    if (!itemId) return [];

    const events = await ctx.db
      .query("item_activity")
      .withIndex("by_item_createdAt", (q) => q.eq("itemId", itemId))
      .order("desc")
      .take(50);

    return events;
  },
});

export const expirePendingClaim = internalMutation({
  args: { claimId: v.id("claims") },
  handler: async (ctx, args) => {
    const claim = await ctx.db.get(args.claimId);
    if (!claim) return;
    if (claim.status !== "pending" || claim.expiredAt) return;

    const now = Date.now();
    const expiresAt = getPendingClaimExpiresAt(claim);
    if (now < expiresAt) {
      await ctx.scheduler.runAt(expiresAt, internal.items.expirePendingClaim, {
        claimId: args.claimId,
      });
      return;
    }

    await ctx.db.patch(args.claimId, { status: "expired", expiredAt: now });

    await ctx.db.insert("lease_activity", {
      itemId: claim.itemId,
      claimId: args.claimId,
      type: "lease_expired",
      actorId: "system",
      createdAt: now,
      note: "Auto-expired: start date passed while still pending",
    });

    const item = await ctx.db.get(claim.itemId);
    if (!item) return;
    for (const recipientId of [item.ownerId, claim.claimerId]) {
      await ctx.db.insert("notifications", {
        recipientId,
        type: "pickup_expired",
        itemId: claim.itemId,
        requestId: args.claimId,
        isRead: false,
        createdAt: now,
      });
    }
  },
});

export const resolveOverdueProposals = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const overduePickup = await ctx.db
      .query("lease_activity")
      .withIndex("by_type_windowEndAt", (q) =>
        q.eq("type", "lease_pickup_proposed").lt("windowEndAt", now),
      )
      .order("asc")
      .take(100);

    const overdueReturn = await ctx.db
      .query("lease_activity")
      .withIndex("by_type_windowEndAt", (q) =>
        q.eq("type", "lease_return_proposed").lt("windowEndAt", now),
      )
      .order("asc")
      .take(100);

    for (const proposal of [...overduePickup, ...overdueReturn]) {
      const claim = await ctx.db.get(proposal.claimId);
      if (!claim) continue;
      if (claim.status !== "approved") continue;

      const events = await ctx.db
        .query("lease_activity")
        .withIndex("by_claim_createdAt", (q) =>
          q.eq("claimId", proposal.claimId),
        )
        .order("desc")
        .take(50);

      const latestSameType = events.find((e) => e.type === proposal.type);
      if (!latestSameType || latestSameType._id !== proposal._id) continue;

      if (proposal.type === "lease_pickup_proposed") {
        if (claim.pickedUpAt || claim.expiredAt) continue;
        if (events.some((e) => e.type === "lease_picked_up")) continue;
        if (events.some((e) => e.type === "lease_expired")) continue;

        await ctx.db.insert("lease_activity", {
          itemId: claim.itemId,
          claimId: claim._id,
          type: "lease_expired",
          actorId: "system",
          createdAt: now,
          note: "Auto-expired after unconfirmed pickup window",
        });

        await ctx.db.patch(claim._id, { expiredAt: now });

        const item = await ctx.db.get(claim.itemId);
        if (!item) continue;
        const recipientIds = [item.ownerId, claim.claimerId];
        for (const recipientId of recipientIds) {
          await ctx.db.insert("notifications", {
            recipientId,
            type: "pickup_expired",
            itemId: claim.itemId,
            requestId: claim._id,
            isRead: false,
            createdAt: now,
          });
        }

        const [ownerExp, borrowerExp] = await Promise.all([
          resolveUserEmail(ctx, item.ownerId, "resolveOverdue/expired/owner"),
          resolveUserEmail(
            ctx,
            claim.claimerId,
            "resolveOverdue/expired/borrower",
          ),
        ]);
        if (ownerExp && borrowerExp) {
          await ctx.scheduler.runAfter(0, internal.emailSend.sendOverdueAlert, {
            claimId: claim._id,
            alertType: "expired",
            ownerEmail: ownerExp.email,
            borrowerEmail: borrowerExp.email,
            ownerLocale: ownerExp.profile.locale,
            borrowerLocale: borrowerExp.profile.locale,
            ownerData: {
              recipientName: ownerExp.name,
              itemName: item.name,
              originalEndDate: claim.startDate,
              counterpartyName: borrowerExp.name,
              counterpartyContacts: borrowerExp.profile.contacts ?? {},
              itemId: claim.itemId,
              role: "owner" as const,
            },
            borrowerData: {
              recipientName: borrowerExp.name,
              itemName: item.name,
              originalEndDate: claim.startDate,
              counterpartyName: ownerExp.name,
              counterpartyContacts: ownerExp.profile.contacts ?? {},
              itemId: claim.itemId,
              role: "borrower" as const,
            },
          });
        }
      } else if (proposal.type === "lease_return_proposed") {
        if (claim.returnedAt || claim.missingAt) continue;
        if (events.some((e) => e.type === "lease_returned")) continue;
        if (events.some((e) => e.type === "lease_missing")) continue;

        const hasPickup =
          claim.pickedUpAt !== undefined ||
          events.some((e) => e.type === "lease_picked_up");
        if (!hasPickup) continue;

        await ctx.db.insert("lease_activity", {
          itemId: claim.itemId,
          claimId: claim._id,
          type: "lease_missing",
          actorId: "system",
          createdAt: now,
          note: "Auto-marked missing after unconfirmed return window",
        });

        await ctx.db.patch(claim._id, { missingAt: now });

        const item = await ctx.db.get(claim.itemId);
        if (!item) continue;
        const recipientIds = [item.ownerId, claim.claimerId];
        for (const recipientId of recipientIds) {
          await ctx.db.insert("notifications", {
            recipientId,
            type: "return_missing",
            itemId: claim.itemId,
            requestId: claim._id,
            isRead: false,
            createdAt: now,
          });
        }

        const [ownerMiss, borrowerMiss] = await Promise.all([
          resolveUserEmail(ctx, item.ownerId, "resolveOverdue/missing/owner"),
          resolveUserEmail(
            ctx,
            claim.claimerId,
            "resolveOverdue/missing/borrower",
          ),
        ]);
        if (ownerMiss && borrowerMiss) {
          await ctx.scheduler.runAfter(0, internal.emailSend.sendOverdueAlert, {
            claimId: claim._id,
            alertType: "missing",
            ownerEmail: ownerMiss.email,
            borrowerEmail: borrowerMiss.email,
            ownerLocale: ownerMiss.profile.locale,
            borrowerLocale: borrowerMiss.profile.locale,
            ownerData: {
              recipientName: ownerMiss.name,
              itemName: item.name,
              originalEndDate: claim.endDate,
              counterpartyName: borrowerMiss.name,
              counterpartyContacts: borrowerMiss.profile.contacts ?? {},
              itemId: claim.itemId,
              role: "owner" as const,
            },
            borrowerData: {
              recipientName: borrowerMiss.name,
              itemName: item.name,
              originalEndDate: claim.endDate,
              counterpartyName: ownerMiss.name,
              counterpartyContacts: ownerMiss.profile.contacts ?? {},
              itemId: claim.itemId,
              role: "borrower" as const,
            },
          });
        }
      }
    }
  },
});

export const generateUploadUrl = mutation(async (ctx) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  throw new Error("Convex storage uploads are disabled; use Cloudinary");
});

// Internal mutation for seed script (no auth required)
export const updateImageInternal = internalMutation({
  args: {
    id: v.id("items"),
    imageStorageIds: v.array(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { imageStorageIds: args.imageStorageIds });
  },
});

export const updateImageCloudinaryInternal = internalMutation({
  args: {
    id: v.id("items"),
    imageCloudinary: v.array(vCloudinaryRef),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { imageCloudinary: args.imageCloudinary });
  },
});

// Image URLs for seeding
const SEED_IMAGE_URLS: Record<string, string> = {
  "Rice Cooker":
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop",
  "Camping Tent":
    "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&h=300&fit=crop",
  "LED Desk Lamp":
    "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=400&h=300&fit=crop",
  "Winter Jacket":
    "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=300&fit=crop",
  "Vietnamese Cookbook":
    "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=300&fit=crop",
  "Folding Chair":
    "https://images.unsplash.com/photo-1503602642458-232111445657?w=400&h=300&fit=crop",
  "Yoga Mat":
    "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=400&h=300&fit=crop",
  "Bluetooth Speaker":
    "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=400&h=300&fit=crop",
  "Coffee Grinder":
    "https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=400&h=300&fit=crop",
  "Board Games Set":
    "https://images.unsplash.com/photo-1611371805429-8b5c1b2c34ba?w=400&h=300&fit=crop",
};

// Action to seed images (can fetch external URLs)
export const seedImages = action({
  args: {},
  handler: async (ctx): Promise<{ success: number; failed: number }> => {
    const items = await ctx.runQuery(api.items.get);
    let success = 0;
    let failed = 0;

    for (const item of items) {
      const imageUrl = SEED_IMAGE_URLS[item.name];
      if (!imageUrl) continue;

      // Skip if already has images
      if (item.imageUrls && item.imageUrls.length > 0) {
        console.log(`Skipping ${item.name} - already has images`);
        continue;
      }

      try {
        console.log(`Downloading image for: ${item.name}`);
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const contentType =
          response.headers.get("content-type") || "image/jpeg";
        const buffer = await response.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const table =
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let base64 = "";
        for (let i = 0; i < bytes.length; i += 3) {
          const a = bytes[i]!;
          const b = i + 1 < bytes.length ? bytes[i + 1]! : 0;
          const c = i + 2 < bytes.length ? bytes[i + 2]! : 0;
          const n = (a << 16) | (b << 8) | c;
          base64 += table[(n >> 18) & 63]!;
          base64 += table[(n >> 12) & 63]!;
          base64 += i + 1 < bytes.length ? table[(n >> 6) & 63]! : "=";
          base64 += i + 2 < bytes.length ? table[n & 63]! : "=";
        }
        const dataUrl = `data:${contentType};base64,${base64}`;

        const uploaded = await cloudinary.upload(ctx, dataUrl, {
          folder: "items",
          tags: ["seed", "items"],
        });
        if (!uploaded.publicId || !uploaded.secureUrl) {
          throw new Error(
            "Cloudinary upload returned missing publicId/secureUrl",
          );
        }

        await ctx.runMutation(internal.items.updateImageCloudinaryInternal, {
          id: item._id,
          imageCloudinary: [
            { publicId: uploaded.publicId, secureUrl: uploaded.secureUrl },
          ],
        });

        console.log(`✅ ${item.name} - done`);
        success++;
      } catch (error) {
        console.error(`❌ ${item.name}:`, error);
        failed++;
      }
    }

    return { success, failed };
  },
});

// Migration: Add ward to items that have location but no ward
export const migrateAddWard = action({
  args: {},
  handler: async (ctx) => {
    // Get all items
    const items = await ctx.runQuery(api.items.get);

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const item of items) {
      // Skip if no location or already has ward
      if (!item.location || item.location.ward) {
        skipped++;
        continue;
      }

      try {
        // Reverse geocode using Nominatim
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${item.location.lat}&lon=${item.location.lng}&addressdetails=1`,
          {
            headers: {
              "User-Agent": "Sharity App Migration",
            },
          },
        );

        if (!response.ok) {
          throw new Error(`Geocoding failed: ${response.status}`);
        }

        const data = await response.json();
        const address = data.address || {};

        // Extract ward (same logic as location-picker-dialog.tsx)
        const ward =
          address.suburb ||
          address.quarter ||
          address.neighbourhood ||
          address.city_district ||
          address.town ||
          address.city ||
          address.county ||
          "Unknown area";

        // Update item with ward
        await ctx.runMutation(internal.items.updateLocationWard, {
          id: item._id,
          ward,
        });

        console.log(`✅ ${item.name} → ${ward}`);
        updated++;

        // Rate limit: Nominatim allows 1 request/second
        await new Promise((resolve) => setTimeout(resolve, 1100));
      } catch (error) {
        console.error(`❌ ${item.name}:`, error);
        failed++;
      }
    }

    return { updated, skipped, failed };
  },
});

export const updateLocationWard = internalMutation({
  args: {
    id: v.id("items"),
    ward: v.string(),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item || !item.location) return;

    await ctx.db.patch(args.id, {
      location: {
        ...item.location,
        ward: args.ward,
      },
    });
  },
});

// ---------------------------------------------------------------------------
// Calendar helpers
// ---------------------------------------------------------------------------

type LeaseActivityDoc = {
  type: string;
  actorId: string;
  windowStartAt?: number;
  windowEndAt?: number;
  proposalId?: string;
};

type NeedsAction =
  | "respond_request"
  | "respond_pickup"
  | "respond_return"
  | "schedule_pickup"
  | "schedule_return"
  | "confirm_pickup"
  | "confirm_return"
  | null;

/**
 * Determine what action (if any) is needed by the given user for a claim,
 * based on the sorted lease_activity event log.
 */
function resolveNeedsAction(args: {
  claim: {
    status: string;
    pickedUpAt?: number;
    returnedAt?: number;
    transferredAt?: number;
    expiredAt?: number;
    missingAt?: number;
  };
  events: LeaseActivityDoc[];
  isOwner: boolean;
  userId: string;
  now: number;
}): NeedsAction {
  const { claim, isOwner } = args;

  // Terminal states — no action needed
  if (
    claim.returnedAt ||
    claim.transferredAt ||
    claim.expiredAt ||
    claim.missingAt
  ) {
    return null;
  }

  const hasPickedUp = !!claim.pickedUpAt;

  if (claim.status === "pending") {
    return isOwner ? "respond_request" : null;
  }

  if (claim.status === "approved") {
    if (!hasPickedUp) {
      return isOwner ? null : "confirm_pickup";
    }

    // Already picked up
    return isOwner ? "confirm_return" : "schedule_return";
  }

  return null;
}

export type CalendarEvent = {
  id: string;
  type: "lending" | "borrowing" | "vacation";
  title: string;
  startDate: number;
  endDate: number;
  isAllDay: boolean;
  itemId?: string;
  claimId?: string;
  needsAction?: NeedsAction;
  counterpartyName?: string;
  vacationNote?: string;
};

/**
 * Aggregate claims (lending + borrowing) and owner_unavailability into a flat
 * list of calendar events for the current user.
 */
export const getCalendarEvents = query({
  args: { startDate: v.number(), endDate: v.number() },
  handler: async (ctx, args): Promise<CalendarEvent[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const userId = identity.subject;
    const events: CalendarEvent[] = [];

    // Statuses that are considered "closed" — exclude from calendar
    const now = Date.now();
    const isClosedClaim = (c: {
      status: string;
      startDate: number;
      returnedAt?: number;
      transferredAt?: number;
      expiredAt?: number;
      missingAt?: number;
    }) => {
      if (c.status === "rejected") return true;
      if (c.returnedAt || c.transferredAt || c.expiredAt || c.missingAt)
        return true;
      // Past-due: pending claims whose start date has already passed
      if (c.status === "pending" && c.startDate < now) return true;
      return false;
    };

    // Helper: resolve user display name from the users table
    const resolveName = async (
      clerkId: string,
    ): Promise<string | undefined> => {
      const profile = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
        .first();
      return profile?.name ?? undefined;
    };

    // Helper: get sorted lease_activity events for a claim
    const getEvents = async (claimId: Id<"claims">) => {
      return await ctx.db
        .query("lease_activity")
        .withIndex("by_claim_createdAt", (q) => q.eq("claimId", claimId))
        .order("asc")
        .collect();
    };

    // Helper: derive effective start/end from activity events
    const resolveTimestamps = (
      claim: { startDate: number; endDate: number; pickedUpAt?: number },
      leaseEvents: LeaseActivityDoc[],
    ): { startDate: number; endDate: number; isAllDay: boolean } => {
      const pickupProposal = leaseEvents.find(
        (e) => e.type === "lease_pickup_proposed",
      );
      const returnProposal = leaseEvents.find(
        (e) => e.type === "lease_return_proposed",
      );

      let startDate = claim.startDate;
      let endDate = claim.endDate;
      let isAllDay = true;

      if (pickupProposal?.windowStartAt) {
        startDate = pickupProposal.windowStartAt;
        isAllDay = false;
      } else if (claim.pickedUpAt) {
        startDate = claim.pickedUpAt;
        isAllDay = false;
      }

      if (returnProposal?.windowEndAt) {
        endDate = returnProposal.windowEndAt;
        isAllDay = false;
      }

      return { startDate, endDate, isAllDay };
    };

    // -----------------------------------------------------------------------
    // 1. Lending: claims where current user is the item owner
    // -----------------------------------------------------------------------
    const ownedItems = await ctx.db
      .query("items")
      .filter((q) => q.eq(q.field("ownerId"), userId))
      .collect();

    for (const item of ownedItems) {
      const itemClaims = await ctx.db
        .query("claims")
        .withIndex("by_item", (q) => q.eq("itemId", item._id))
        .collect();

      for (const claim of itemClaims) {
        if (isClosedClaim(claim)) continue;

        // Overlap check with requested range
        if (claim.endDate < args.startDate || claim.startDate > args.endDate)
          continue;

        const leaseEvents = await getEvents(claim._id);
        const { startDate, endDate, isAllDay } = resolveTimestamps(
          claim,
          leaseEvents,
        );
        const counterpartyName = await resolveName(claim.claimerId);
        const needsAction = resolveNeedsAction({
          claim,
          events: leaseEvents,
          isOwner: true,
          userId,
          now,
        });

        const borrowerLabel = counterpartyName ?? claim.claimerId.slice(0, 6);
        events.push({
          id: `lending-${claim._id}`,
          type: "lending",
          title: `${item.name} → ${borrowerLabel}`,
          startDate,
          endDate,
          isAllDay,
          itemId: item._id,
          claimId: claim._id,
          needsAction,
          counterpartyName,
        });
      }
    }

    // -----------------------------------------------------------------------
    // 2. Borrowing: claims where current user is the claimer
    // -----------------------------------------------------------------------
    const borrowingClaims = await ctx.db
      .query("claims")
      .withIndex("by_claimer", (q) => q.eq("claimerId", userId))
      .collect();

    for (const claim of borrowingClaims) {
      if (isClosedClaim(claim)) continue;

      // Overlap check with requested range
      if (claim.endDate < args.startDate || claim.startDate > args.endDate)
        continue;

      const item = await ctx.db.get(claim.itemId);
      if (!item) continue;

      const leaseEvents = await getEvents(claim._id);
      const { startDate, endDate, isAllDay } = resolveTimestamps(
        claim,
        leaseEvents,
      );
      const counterpartyName = await resolveName(item.ownerId);
      const needsAction = resolveNeedsAction({
        claim,
        events: leaseEvents,
        isOwner: false,
        userId,
        now,
      });

      const ownerLabel = counterpartyName ?? item.ownerId.slice(0, 6);
      events.push({
        id: `borrowing-${claim._id}`,
        type: "borrowing",
        title: `${item.name} ← ${ownerLabel}`,
        startDate,
        endDate,
        isAllDay,
        itemId: item._id,
        claimId: claim._id,
        needsAction,
        counterpartyName,
      });
    }

    // -----------------------------------------------------------------------
    // 3. Vacation: owner_unavailability ranges
    // -----------------------------------------------------------------------
    const vacationBlocks = await ctx.db
      .query("owner_unavailability")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();

    for (const block of vacationBlocks) {
      // Overlap check with requested range
      if (block.endDate < args.startDate || block.startDate > args.endDate)
        continue;

      events.push({
        id: `vacation-${block._id}`,
        type: "vacation",
        title: "Vacation",
        startDate: block.startDate,
        endDate: block.endDate,
        isAllDay: true,
        vacationNote: block.note,
      });
    }

    return events;
  },
});

/**
 * Get items currently borrowed by the authenticated user.
 * Returns items where the user has an approved claim that has been picked up
 * but not yet returned/transferred/expired/marked as missing.
 */
export const getMyBorrowedItems = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Get approved claims by the user
    const myClaims = await ctx.db
      .query("claims")
      .withIndex("by_claimer", (q) => q.eq("claimerId", identity.subject))
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();

    // Filter to active borrowed items (picked up but not closed)
    const activeBorrowedClaims = myClaims.filter(
      (c) =>
        !!c.pickedUpAt &&
        !c.returnedAt &&
        !c.transferredAt &&
        !c.expiredAt &&
        !c.missingAt,
    );

    // Build result with item details, claim info, and owner info
    const result = await Promise.all(
      activeBorrowedClaims.map(async (claim) => {
        const item = await ctx.db.get(claim.itemId);
        if (!item) return null;

        // Get owner profile
        const ownerProfile = await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", item.ownerId))
          .first();

        let ownerAvatarUrl: string | null = null;
        if (ownerProfile?.avatarCloudinary) {
          ownerAvatarUrl = ownerProfile.avatarCloudinary.secureUrl;
        }

        // Resolve item images
        const { images, imageUrls } = await resolveImages({
          ctx,
          imageCloudinary: item.imageCloudinary,
          imageStorageIds: item.imageStorageIds,
        });

        return {
          ...item,
          images,
          imageUrls,
          claim: {
            _id: claim._id,
            startDate: claim.startDate,
            endDate: claim.endDate,
            pickedUpAt: claim.pickedUpAt,
          },
          owner: {
            id: item.ownerId,
            name: ownerProfile?.name || null,
            avatarUrl: ownerAvatarUrl,
          },
        };
      }),
    );

    // Filter out any nulls and return
    return result.filter(
      (item): item is NonNullable<typeof item> => item !== null,
    );
  },
});
