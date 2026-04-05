import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { vCloudinaryRef } from "./mediaTypes";

/**
 * Check if current user can rate someone for a specific claim
 * Returns the role that can be rated (lender or borrower) or null if cannot rate
 */
export const canRate = query({
  args: { claimId: v.id("claims") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return { canRate: false, reason: "Not authenticated" };
    }

    const claim = await ctx.db.get(args.claimId);
    if (!claim) {
      return { canRate: false, reason: "Claim not found" };
    }

    // Only approved claims can be rated
    if (claim.status !== "approved") {
      return { canRate: false, reason: "Claim is not approved" };
    }

    // Check if the lending period has started (can rate during or after)
    const now = Date.now();
    if (now < claim.startDate) {
      return { canRate: false, reason: "Lending period has not started yet" };
    }

    const item = await ctx.db.get(claim.itemId);
    if (!item) {
      return { canRate: false, reason: "Item not found" };
    }

    // Determine who is rating whom
    const isLender = item.ownerId === identity.subject;
    const isBorrower = claim.claimerId === identity.subject;

    if (!isLender && !isBorrower) {
      return { canRate: false, reason: "You are not part of this transaction" };
    }

    // Only allow rating after transaction is completed
    // For loan items: must be returned
    // For giveaway items: must be transferred
    if (item.giveaway) {
      if (!claim.transferredAt) {
        return {
          canRate: false,
          reason: "Transaction not completed yet (item not transferred)",
        };
      }
    } else {
      if (!claim.returnedAt) {
        return {
          canRate: false,
          reason: "Transaction not completed yet (item not returned)",
        };
      }
    }

    // Check if already rated
    const existingRating = await ctx.db
      .query("ratings")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .filter((q) => q.eq(q.field("fromUserId"), identity.subject))
      .first();

    if (existingRating) {
      return {
        canRate: false,
        reason: "You have already rated this transaction",
      };
    }

    // Lender rates the borrower, borrower rates the lender
    const targetRole = isLender ? "borrower" : "lender";
    const targetUserId = isLender ? claim.claimerId : item.ownerId;

    return {
      canRate: true,
      targetRole,
      targetUserId,
      itemName: item.name,
    };
  },
});

/**
 * Create a rating for a completed lending transaction
 */
export const createRating = mutation({
  args: {
    claimId: v.id("claims"),
    stars: v.number(), // 1-5
    comment: v.optional(v.string()),
    photoStorageIds: v.optional(v.array(v.id("_storage"))),
    photoCloudinary: v.optional(v.array(vCloudinaryRef)),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    if ((args.photoStorageIds?.length ?? 0) > 0) {
      throw new Error("Convex storage photos are disabled; use Cloudinary");
    }

    // Validate stars
    if (args.stars < 1 || args.stars > 5 || !Number.isInteger(args.stars)) {
      throw new Error("Stars must be an integer between 1 and 5");
    }

    const claim = await ctx.db.get(args.claimId);
    if (!claim) {
      throw new Error("Claim not found");
    }

    if (claim.status !== "approved") {
      throw new Error("Can only rate approved claims");
    }

    const item = await ctx.db.get(claim.itemId);
    if (!item) {
      throw new Error("Item not found");
    }

    // Determine roles
    const isLender = item.ownerId === identity.subject;
    const isBorrower = claim.claimerId === identity.subject;

    if (!isLender && !isBorrower) {
      throw new Error("You are not part of this transaction");
    }

    // Check if already rated
    const existingRating = await ctx.db
      .query("ratings")
      .withIndex("by_claim", (q) => q.eq("claimId", args.claimId))
      .filter((q) => q.eq(q.field("fromUserId"), identity.subject))
      .first();

    if (existingRating) {
      throw new Error("You have already rated this transaction");
    }

    // Lender rates borrower, borrower rates lender
    const targetRole: "lender" | "borrower" = isLender ? "borrower" : "lender";
    const toUserId = isLender ? claim.claimerId : item.ownerId;

    const createdAt = Date.now();

    const ratingId = await ctx.db.insert("ratings", {
      claimId: args.claimId,
      fromUserId: identity.subject,
      toUserId,
      role: targetRole,
      stars: args.stars,
      comment: args.comment,
      photoStorageIds: undefined,
      photoCloudinary: args.photoCloudinary,
      createdAt,
    });

    await ctx.db.insert("notifications", {
      recipientId: toUserId,
      type: "rating_received",
      itemId: claim.itemId,
      requestId: args.claimId,
      isRead: false,
      createdAt,
    });

    return ratingId;
  },
});

/**
 * Get all ratings for a user
 */
export const getRatingsForUser = query({
  args: {
    userId: v.string(),
    role: v.optional(v.union(v.literal("lender"), v.literal("borrower"))),
  },
  handler: async (ctx, args) => {
    const ratingsQuery = ctx.db
      .query("ratings")
      .withIndex("by_to_user", (q) => q.eq("toUserId", args.userId));

    const allRatings = await ratingsQuery.collect();

    // Filter by role if specified
    const ratings = args.role
      ? allRatings.filter((r) => r.role === args.role)
      : allRatings;

    // Get photo URLs
    const ratingsWithPhotos = await Promise.all(
      ratings.map(async (rating) => {
        const cloudUrls = (rating.photoCloudinary ?? []).map(
          (p) => p.secureUrl,
        );
        const photoUrls = cloudUrls;

        return {
          ...rating,
          photoUrls,
        };
      }),
    );

    // Sort by newest first
    return ratingsWithPhotos.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Get rating summary for a user (average stars and count)
 */
export const getRatingSummary = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const ratings = await ctx.db
      .query("ratings")
      .withIndex("by_to_user", (q) => q.eq("toUserId", args.userId))
      .collect();

    if (ratings.length === 0) {
      return {
        averageStars: null,
        totalRatings: 0,
        asLender: { averageStars: null, count: 0 },
        asBorrower: { averageStars: null, count: 0 },
      };
    }

    // Overall stats
    const totalStars = ratings.reduce((sum, r) => sum + r.stars, 0);
    const averageStars = totalStars / ratings.length;

    // As lender (when they lent items)
    const lenderRatings = ratings.filter((r) => r.role === "lender");
    const lenderAvg =
      lenderRatings.length > 0
        ? lenderRatings.reduce((sum, r) => sum + r.stars, 0) /
          lenderRatings.length
        : null;

    // As borrower (when they borrowed items)
    const borrowerRatings = ratings.filter((r) => r.role === "borrower");
    const borrowerAvg =
      borrowerRatings.length > 0
        ? borrowerRatings.reduce((sum, r) => sum + r.stars, 0) /
          borrowerRatings.length
        : null;

    return {
      averageStars: Math.round(averageStars * 10) / 10, // Round to 1 decimal
      totalRatings: ratings.length,
      asLender: {
        averageStars: lenderAvg ? Math.round(lenderAvg * 10) / 10 : null,
        count: lenderRatings.length,
      },
      asBorrower: {
        averageStars: borrowerAvg ? Math.round(borrowerAvg * 10) / 10 : null,
        count: borrowerRatings.length,
      },
    };
  },
});

/**
 * Get pending ratings for current user (transactions they can still rate)
 */
export const getMyPendingRatings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Get all approved claims where user is lender or borrower
    const allClaims = await ctx.db
      .query("claims")
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();

    const allItems = await ctx.db.query("items").collect();
    const itemsMap = new Map(allItems.map((i) => [i._id, i]));

    // Get all users to fetch names
    const allUsers = await ctx.db.query("users").collect();
    const usersMap = new Map(allUsers.map((u) => [u.clerkId, u]));

    // Get ratings already given by this user
    const myRatings = await ctx.db
      .query("ratings")
      .withIndex("by_from_user", (q) => q.eq("fromUserId", identity.subject))
      .collect();

    const ratedClaimIds = new Set(myRatings.map((r) => r.claimId));

    const now = Date.now();
    const pendingRatings = [];

    for (const claim of allClaims) {
      // Skip if already rated
      if (ratedClaimIds.has(claim._id)) continue;

      // Skip if lending hasn't started yet
      if (now < claim.startDate) continue;

      const item = itemsMap.get(claim.itemId);
      if (!item) continue;

      // Only allow rating after transaction is completed
      // For loan items: must be returned
      // For giveaway items: must be transferred
      if (item.giveaway) {
        if (!claim.transferredAt) continue;
      } else {
        if (!claim.returnedAt) continue;
      }

      const isLender = item.ownerId === identity.subject;
      const isBorrower = claim.claimerId === identity.subject;

      if (!isLender && !isBorrower) continue;

      let imageUrl: string | null = null;
      if (item.imageCloudinary?.[0]) {
        imageUrl = item.imageCloudinary[0].secureUrl;
      }

      const targetUserId = isLender ? claim.claimerId : item.ownerId;
      const targetUser = usersMap.get(targetUserId);
      const targetUserName = targetUser?.name || null;

      pendingRatings.push({
        claimId: claim._id,
        itemId: claim.itemId,
        itemName: item.name,
        itemImageUrl: imageUrl,
        targetRole: isLender ? ("borrower" as const) : ("lender" as const),
        targetUserId,
        targetUserName,
        startDate: claim.startDate,
        endDate: claim.endDate,
        isGiveaway: item.giveaway ?? false,
      });
    }

    return pendingRatings;
  },
});

/**
 * Generate upload URL for rating photos
 */
export const generateRatingPhotoUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }
    throw new Error("Convex storage uploads are disabled; use Cloudinary");
  },
});
