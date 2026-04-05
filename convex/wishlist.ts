import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { vCloudinaryRef } from "./mediaTypes";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject;

    const wishlistItems = await ctx.db
      .query("wishlist")
      .withIndex("by_createdAt")
      .order("desc")
      .collect();

    // Fetch all items to check for matches
    // Note: As the item database grows, this should be optimized to use a search index
    // or backend-guided search. For MVP < 1000 items, in-memory check is fine.
    const items = await ctx.db.query("items").collect();

    // Resolve images for all wishlist items
    const results = await Promise.all(
      wishlistItems.map(async (wishlistItem) => {
        const matchCount = items.filter((item) => {
          const itemText = (
            item.name +
            " " +
            (item.description || "")
          ).toLowerCase();
          return itemText.includes(wishlistItem.text.toLowerCase());
        }).length;

        const isLiked = userId ? wishlistItem.votes.includes(userId) : false;

        // Resolve image URLs
        const images: (
          | { source: "cloudinary"; publicId: string; url: string }
          | { source: "storage"; storageId: string; url: string }
        )[] = [
          ...(wishlistItem.imageCloudinary ?? []).map((img) => ({
            source: "cloudinary" as const,
            publicId: img.publicId,
            url: img.secureUrl,
          })),
        ];

        return {
          ...wishlistItem,
          matchCount,
          isLiked,
          images,
          isOwner: userId === wishlistItem.userId,
        };
      }),
    );

    return results;
  },
});

export const create = mutation({
  args: {
    text: v.string(),
    imageStorageIds: v.optional(v.array(v.id("_storage"))),
    imageCloudinary: v.optional(v.array(vCloudinaryRef)),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    if ((args.imageStorageIds?.length ?? 0) > 0) {
      throw new Error("Convex storage images are disabled; use Cloudinary");
    }

    await ctx.db.insert("wishlist", {
      text: args.text,
      userId: identity.subject,
      votes: [],
      createdAt: Date.now(),
      imageStorageIds: undefined,
      imageCloudinary: args.imageCloudinary,
    });
  },
});

export const toggleVote = mutation({
  args: { id: v.id("wishlist") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const userId = identity.subject;

    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found");

    const hasVoted = item.votes.includes(userId);
    const newVotes = hasVoted
      ? item.votes.filter((id) => id !== userId)
      : [...item.votes, userId];

    await ctx.db.patch(args.id, { votes: newVotes });
  },
});

export const deleteItem = mutation({
  args: { id: v.id("wishlist") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Wish not found");
    if (item.userId !== identity.subject) throw new Error("Not authorized");

    await ctx.db.delete(args.id);
  },
});

export const update = mutation({
  args: {
    id: v.id("wishlist"),
    text: v.string(),
    imageStorageIds: v.optional(v.array(v.id("_storage"))),
    imageCloudinary: v.optional(v.array(vCloudinaryRef)),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found");
    if (item.userId !== identity.subject) throw new Error("Not authorized");

    if ((args.imageStorageIds?.length ?? 0) > 0) {
      throw new Error("Convex storage images are disabled; use Cloudinary");
    }

    await ctx.db.patch(args.id, {
      text: args.text,
      imageStorageIds: undefined,
      imageCloudinary: args.imageCloudinary,
    });
  },
});
