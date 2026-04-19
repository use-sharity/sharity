import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", identity.subject))
      .order("desc")
      .collect();

    return Promise.all(
      notifications.map(async (n) => {
        const item = await ctx.db.get(n.itemId);
        const claim = n.requestId ? await ctx.db.get(n.requestId) : null;

        // For rating_received notifications, fetch the rater's name
        let raterName: string | null = null;
        if (n.type === "rating_received" && n.requestId) {
          const rating = await ctx.db
            .query("ratings")
            .withIndex("by_claim", (q) => q.eq("claimId", n.requestId!))
            .filter((q) => q.eq(q.field("toUserId"), identity.subject))
            .order("desc")
            .first();

          if (rating) {
            const raterProfile = await ctx.db
              .query("users")
              .withIndex("by_clerk_id", (q) =>
                q.eq("clerkId", rating.fromUserId),
              )
              .first();
            raterName = raterProfile?.name || null;
          }
        }

        return { ...n, item, claim, raterName };
      }),
    );
  },
});

export const markAsRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const notification = await ctx.db.get(args.notificationId);
    if (!notification) throw new Error("Notification not found");

    if (notification.recipientId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.notificationId, { isRead: true });
  },
});

export const markAllAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient", (q) => q.eq("recipientId", identity.subject))
      .filter((q) => q.eq(q.field("isRead"), false))
      .collect();

    await Promise.all(
      notifications.map((n) => ctx.db.patch(n._id, { isRead: true })),
    );
  },
});

export const subscribeAvailability = mutation({
  args: { id: v.id("items") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const existing = await ctx.db
      .query("availability_alerts")
      .withIndex("by_user_item", (q) =>
        q.eq("userId", identity.subject).eq("itemId", args.id),
      )
      .first();

    if (existing) {
      // Already subscribed, so unsubscribe (toggle)
      await ctx.db.delete(existing._id);
      return false; // Subscribed: false
    } else {
      await ctx.db.insert("availability_alerts", {
        itemId: args.id,
        userId: identity.subject,
        createdAt: Date.now(),
      });
      return true; // Subscribed: true
    }
  },
});

export const getAvailabilitySubscription = query({
  args: { id: v.id("items") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return false;

    const existing = await ctx.db
      .query("availability_alerts")
      .withIndex("by_user_item", (q) =>
        q.eq("userId", identity.subject).eq("itemId", args.id),
      )
      .first();

    return !!existing;
  },
});
