import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { WithoutSystemFields } from "convex/server";
import type { Doc } from "./_generated/dataModel";
import { vCloudinaryRef } from "./mediaTypes";

type UserFields = WithoutSystemFields<Doc<"users">>;
type NullableFields<T> = { [K in keyof T]: T[K] | null };
type MyProfile = NullableFields<UserFields> & {
  avatarUrl: string | null;
  hasProfile: boolean;
  clerkData: {
    name: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
};

// Contact info validator
const contactsValidator = v.optional(
  v.object({
    telegram: v.optional(v.string()),
    whatsapp: v.optional(v.string()),
    facebook: v.optional(v.string()),
    phone: v.optional(v.string()),
  }),
);

/**
 * Get current user's profile
 */
export const getMyProfile = query({
  args: {},
  handler: async (ctx): Promise<MyProfile | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const clerkData = {
      name: identity.name || identity.nickname || null,
      email: identity.email || null,
      avatarUrl: identity.pictureUrl || null,
    };

    const profile = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!profile) {
      return {
        clerkId: identity.subject,
        email: clerkData.email,
        name: clerkData.name,
        avatarStorageId: null,
        avatarCloudinary: null,
        avatarUrl: clerkData.avatarUrl,
        address: null,
        ward: null,
        bio: null,
        contacts: null,
        digestFrequency: null,
        locale: null,
        createdAt: null,
        updatedAt: null,
        hasProfile: false,
        clerkData,
      };
    }

    let avatarUrl: string | null = null;
    if (profile.avatarCloudinary) {
      avatarUrl = profile.avatarCloudinary.secureUrl;
    } else if (identity.pictureUrl) {
      avatarUrl = identity.pictureUrl;
    }

    return {
      clerkId: profile.clerkId,
      email: clerkData.email,
      name: profile.name ?? null,
      avatarStorageId: profile.avatarStorageId ?? null,
      avatarCloudinary: profile.avatarCloudinary ?? null,
      avatarUrl,
      address: profile.address ?? null,
      ward: profile.ward ?? null,
      bio: profile.bio ?? null,
      contacts: profile.contacts ?? null,
      digestFrequency: profile.digestFrequency ?? null,
      locale: profile.locale ?? null,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      hasProfile: true,
      clerkData,
    };
  },
});

/**
 * Get basic user info (name + avatar) for display in UI
 * Lightweight query for UserLink component
 */
export const getBasicInfo = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();

    if (!profile) {
      return {
        userId: args.userId,
        name: null,
        avatarUrl: null,
      };
    }

    let avatarUrl: string | null = null;
    if (profile.avatarCloudinary) {
      avatarUrl = profile.avatarCloudinary.secureUrl;
    }

    return {
      userId: args.userId,
      name: profile.name || null,
      avatarUrl,
    };
  },
});

/**
 * Get user profile by Clerk ID (for viewing other users)
 */
export const getProfile = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();

    if (!profile) {
      return null;
    }

    // Get avatar URL if exists
    let avatarUrl: string | null = null;
    if (profile.avatarCloudinary) {
      avatarUrl = profile.avatarCloudinary.secureUrl;
    }

    // Don't expose full contact details to other users - just show what's available
    return {
      _id: profile._id,
      clerkId: profile.clerkId,
      name: profile.name,
      avatarUrl,
      address: profile.address,
      bio: profile.bio, // Bio is public
      // Only show which contact methods are available, not the actual values
      availableContacts: {
        telegram: !!profile.contacts?.telegram,
        whatsapp: !!profile.contacts?.whatsapp,
        facebook: !!profile.contacts?.facebook,
        phone: !!profile.contacts?.phone,
      },
      createdAt: profile.createdAt,
    };
  },
});

/**
 * Get full profile with contacts (only for users who have an approved claim with this user)
 */
export const getProfileWithContacts = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    // Check if there's an approved claim between these users
    const claims = await ctx.db.query("claims").collect();
    const items = await ctx.db.query("items").collect();

    const hasApprovedInteraction = claims.some((claim) => {
      if (claim.status !== "approved") return false;

      const item = items.find((i) => i._id === claim.itemId);
      if (!item) return false;

      // Current user is borrower, target is lender
      if (
        claim.claimerId === identity.subject &&
        item.ownerId === args.userId
      ) {
        return true;
      }
      // Current user is lender, target is borrower
      if (
        item.ownerId === identity.subject &&
        claim.claimerId === args.userId
      ) {
        return true;
      }
      return false;
    });

    if (!hasApprovedInteraction) {
      return null; // No access to contacts
    }

    const profile = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.userId))
      .first();

    if (!profile) {
      return null;
    }

    let avatarUrl: string | null = null;
    if (profile.avatarCloudinary) {
      avatarUrl = profile.avatarCloudinary.secureUrl;
    }

    return {
      ...profile,
      avatarUrl,
    };
  },
});

/**
 * Create or update user profile
 */
const localeValidator = v.optional(
  v.union(v.literal("en"), v.literal("vi"), v.literal("ru")),
);

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    bio: v.optional(v.string()),
    contacts: contactsValidator,
    avatarStorageId: v.optional(v.id("_storage")),
    avatarCloudinary: v.optional(vCloudinaryRef),
    digestFrequency: v.optional(
      v.union(v.literal("daily"), v.literal("weekly"), v.literal("off")),
    ),
    locale: localeValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    if (args.avatarStorageId) {
      throw new Error("Convex storage avatars are disabled; use Cloudinary");
    }

    // Validate bio length
    if (args.bio && args.bio.length > 500) {
      throw new Error("Bio must be 500 characters or less");
    }

    const existingProfile = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    const now = Date.now();

    if (existingProfile) {
      // Update existing profile
      await ctx.db.patch(existingProfile._id, {
        ...args,
        updatedAt: now,
      });
      return existingProfile._id;
    }

    // Create new profile
    const profileId = await ctx.db.insert("users", {
      clerkId: identity.subject,
      name: args.name,
      address: args.address,
      bio: args.bio,
      contacts: args.contacts,
      avatarStorageId: undefined,
      avatarCloudinary: args.avatarCloudinary,
      digestFrequency: args.digestFrequency,
      createdAt: now,
      updatedAt: now,
    });

    return profileId;
  },
});

/**
 * Update only the locale preference (called by LanguageSwitcher)
 */
export const updateLocale = mutation({
  args: {
    locale: v.union(v.literal("en"), v.literal("vi"), v.literal("ru")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, { locale: args.locale, updatedAt: now });
    } else {
      await ctx.db.insert("users", {
        clerkId: identity.subject,
        locale: args.locale,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Generate upload URL for avatar
 */
export const generateAvatarUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }
    throw new Error("Convex storage uploads are disabled; use Cloudinary");
  },
});

/**
 * Internal: upsert user profile from Clerk webhook (email sync)
 */
export const upsertFromWebhook = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.union(v.string(), v.null()),
    name: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    const now = Date.now();

    if (existing) {
      const patch: Record<string, unknown> = { updatedAt: now };
      if (args.email !== null) patch.email = args.email;
      if (args.name !== null && !existing.name) patch.name = args.name;
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("users", {
        clerkId: args.clerkId,
        email: args.email ?? undefined,
        name: args.name ?? undefined,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Get user's lending and borrowing history
 */
export const getUserHistory = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Get all items owned by this user
    const ownedItems = await ctx.db
      .query("items")
      .filter((q) => q.eq(q.field("ownerId"), args.userId))
      .collect();

    const ownedItemIds = new Set(ownedItems.map((i) => i._id));

    // Get all claims
    const allClaims = await ctx.db.query("claims").collect();

    // Lending history: claims on items this user owns (approved or completed)
    const lendingClaims = allClaims.filter(
      (c) => ownedItemIds.has(c.itemId) && c.status === "approved",
    );

    // Borrowing history: claims made by this user
    const borrowingClaims = allClaims.filter(
      (c) => c.claimerId === args.userId && c.status === "approved",
    );

    // Get item details for all claims
    const allItems = await ctx.db.query("items").collect();
    const itemsMap = new Map(allItems.map((i) => [i._id, i]));

    // Format lending history
    const lendingHistory = await Promise.all(
      lendingClaims.map(async (claim) => {
        const item = itemsMap.get(claim.itemId);
        let imageUrl: string | null = null;
        if (item?.imageCloudinary?.[0]) {
          imageUrl = item.imageCloudinary[0].secureUrl;
        }
        return {
          claimId: claim._id,
          itemId: claim.itemId,
          itemName: item?.name || "Unknown",
          itemImageUrl: imageUrl,
          borrowerId: claim.claimerId,
          startDate: claim.startDate,
          endDate: claim.endDate,
          status: claim.status,
        };
      }),
    );

    // Format borrowing history
    const borrowingHistory = await Promise.all(
      borrowingClaims.map(async (claim) => {
        const item = itemsMap.get(claim.itemId);
        let imageUrl: string | null = null;
        if (item?.imageCloudinary?.[0]) {
          imageUrl = item.imageCloudinary[0].secureUrl;
        }
        return {
          claimId: claim._id,
          itemId: claim.itemId,
          itemName: item?.name || "Unknown",
          itemImageUrl: imageUrl,
          lenderId: item?.ownerId || "Unknown",
          startDate: claim.startDate,
          endDate: claim.endDate,
          status: claim.status,
        };
      }),
    );

    return {
      lending: lendingHistory,
      borrowing: borrowingHistory,
      stats: {
        totalLent: lendingHistory.length,
        totalBorrowed: borrowingHistory.length,
      },
    };
  },
});

/**
 * Backfill email from Clerk JWT if missing in DB.
 * Called on client mount; guarded by sessionStorage on the client side.
 * Cost: 1 index read; 1 write only when email is absent.
 */
export const ensureEmail = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.email) return;
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!existing || existing.email) return;
    await ctx.db.patch(existing._id, { email: identity.email });
  },
});

/**
 * Internal: get a user's stored locale preference (falls back to "en")
 */
export const getLocale = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();
    return user?.locale ?? "en";
  },
});

// ─── One-off migration: backfill emails from Clerk ───────────────────────────

export const listUsersWithoutEmail = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("users").collect();
    return all.filter((u) => !u.email).map((u) => u.clerkId);
  },
});

interface ClerkUser {
  id: string;
  email_addresses: Array<{
    id: string;
    email_address: string;
  }>;
  primary_email_address_id: string;
  first_name: string | null;
  last_name: string | null;
}

export const backfillEmailsFromClerk = internalAction({
  args: {},
  handler: async (ctx) => {
    const clerkSecret = process.env.CLERK_SECRET_KEY;
    if (!clerkSecret) throw new Error("CLERK_SECRET_KEY env var not set");

    const clerkIds: string[] = await ctx.runQuery(
      internal.users.listUsersWithoutEmail,
      {},
    );

    if (clerkIds.length === 0) {
      console.log("backfillEmailsFromClerk: all users already have emails");
      return;
    }

    console.log(
      `backfillEmailsFromClerk: ${clerkIds.length} users missing email`,
    );

    let updated = 0;
    let skipped = 0;

    for (const clerkId of clerkIds) {
      const res = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
        headers: { Authorization: `Bearer ${clerkSecret}` },
      });

      if (!res.ok) {
        console.warn(
          `backfillEmailsFromClerk: failed to fetch ${clerkId}: HTTP ${res.status}`,
        );
        skipped++;
        continue;
      }

      const user = (await res.json()) as ClerkUser;
      const primary = user.email_addresses.find(
        (e) => e.id === user.primary_email_address_id,
      );
      const email = primary?.email_address ?? null;
      const name =
        [user.first_name, user.last_name].filter(Boolean).join(" ") || null;

      await ctx.runMutation(internal.users.upsertFromWebhook, {
        clerkId,
        email,
        name,
      });
      updated++;
    }

    console.log(
      `backfillEmailsFromClerk: done — updated ${updated}, skipped ${skipped}`,
    );
  },
});
