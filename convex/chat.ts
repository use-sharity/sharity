import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";

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
        items: matches.map((i) => ({
          itemId: i._id,
          name: i.name,
          category: i.category ?? "other",
          description: i.description ?? "",
        })),
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
          claimId: c._id,
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

export const resolveMyItem = query({
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
      return { found: false as const, items: myItems.map((i) => i.name) };
    }
    if (matches.length > 1) {
      return {
        found: "multiple" as const,
        items: matches.map((i) => ({
          itemId: i._id,
          name: i.name,
          category: i.category ?? "other",
          description: i.description ?? "",
        })),
      };
    }

    const item = matches[0];
    const claims = await ctx.db
      .query("claims")
      .withIndex("by_item", (q2) => q2.eq("itemId", item._id))
      .collect();

    const enrichedClaims = await Promise.all(
      claims.map(async (c) => {
        const user = await ctx.db
          .query("users")
          .filter((q2) => q2.eq(q2.field("clerkId"), c.claimerId))
          .first();
        return {
          claimId: c._id,
          claimerName: user?.name ?? "a neighbor",
          claimerId: c.claimerId,
          status: c.status,
          startDate: c.startDate,
          endDate: c.endDate,
          pickedUpAt: c.pickedUpAt,
        };
      }),
    );

    return {
      found: true as const,
      itemId: item._id,
      itemName: item.name,
      claims: enrichedClaims,
    };
  },
});

export const resolveMyItemById = query({
  args: { itemId: v.id("items") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    const item = await ctx.db.get(args.itemId);
    if (!item || item.ownerId !== userId) return null;

    const claims = await ctx.db
      .query("claims")
      .withIndex("by_item", (q) => q.eq("itemId", item._id))
      .collect();

    const enrichedClaims = await Promise.all(
      claims.map(async (c) => {
        const user = await ctx.db
          .query("users")
          .filter((q2) => q2.eq(q2.field("clerkId"), c.claimerId))
          .first();
        return {
          claimId: c._id,
          claimerName: user?.name ?? "a neighbor",
          claimerId: c.claimerId,
          status: c.status,
          startDate: c.startDate,
          endDate: c.endDate,
          pickedUpAt: c.pickedUpAt,
        };
      }),
    );

    return {
      itemId: item._id,
      itemName: item.name,
      claims: enrichedClaims,
    };
  },
});

export const resolveMyBorrowedItem = query({
  args: { itemName: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    const myClaims = await ctx.db
      .query("claims")
      .withIndex("by_claimer", (q) => q.eq("claimerId", userId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "approved"),
        ),
      )
      .collect();

    const itemsWithClaims = await Promise.all(
      myClaims.map(async (c) => {
        const item = await ctx.db.get(c.itemId);
        if (!item) return null;
        const owner = await ctx.db
          .query("users")
          .filter((q) => q.eq(q.field("clerkId"), item.ownerId))
          .first();
        return {
          itemId: item._id,
          itemName: item.name,
          claimId: c._id,
          ownerName: owner?.name ?? "a neighbor",
          status: c.status,
        };
      }),
    );

    const valid = itemsWithClaims.filter((x) => x !== null);
    const q = args.itemName.toLowerCase();
    const matches = valid.filter((x) => x.itemName.toLowerCase().includes(q));

    if (matches.length === 0) {
      return { found: false as const, items: valid.map((x) => x.itemName) };
    }
    if (matches.length > 1) {
      return {
        found: "multiple" as const,
        items: matches.map((x) => x.itemName),
      };
    }

    return { found: true as const, ...matches[0] };
  },
});

// Helper: get the timestamp of the user's last chat clear
async function getClearedAt(
  ctx: Pick<QueryCtx, "db">,
  userId: string,
): Promise<number> {
  const record = await ctx.db
    .query("chat_cleared_at")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return record?.clearedAt ?? 0;
}

export const getMessages = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    const clearedAt = await getClearedAt(ctx, userId);

    const messages = await ctx.db
      .query("chat_messages")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(200);

    // Return only messages after the last clear, in chronological order
    return messages
      .filter((m) => m.createdAt > clearedAt)
      .reverse()
      .map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      }));
  },
});

export const saveMessage = mutation({
  args: {
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const userId = identity.subject;

    await ctx.db.insert("chat_messages", {
      userId,
      role: args.role,
      content: args.content,
      createdAt: Date.now(),
    });
  },
});

export const clearMessages = mutation({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const userId = identity.subject;

    // Soft-delete: mark the clear time instead of deleting messages
    const existing = await ctx.db
      .query("chat_cleared_at")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { clearedAt: Date.now() });
    } else {
      await ctx.db.insert("chat_cleared_at", {
        userId,
        clearedAt: Date.now(),
      });
    }
  },
});
