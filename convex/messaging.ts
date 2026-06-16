import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sortedParticipants(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

async function assertParticipant(
  participantIds: string[],
  userId: string,
): Promise<void> {
  if (!participantIds.includes(userId)) {
    throw new Error("Not a participant");
  }
}

function latestByType<T extends Doc<"lease_activity">>(
  events: Doc<"lease_activity">[],
  type: T["type"],
): Doc<"lease_activity"> | undefined {
  return events.find((event) => event.type === type);
}

// ---------------------------------------------------------------------------
// startConversation — idempotent: returns existing _id if already present
// ---------------------------------------------------------------------------

export const startConversation = mutation({
  args: {
    otherUserId: v.string(),
    itemId: v.id("items"),
    claimId: v.optional(v.id("claims")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const me = identity.subject;

    if (args.otherUserId === me) {
      throw new Error("Cannot start conversation with yourself");
    }

    const item = await ctx.db.get(args.itemId);
    if (!item) throw new Error("Item not found");

    // otherUserId must be item owner or a claimer of the item
    const isOwner = args.otherUserId === item.ownerId;
    if (!isOwner) {
      const isClaimer =
        (await ctx.db
          .query("claims")
          .withIndex("by_item", (q) => q.eq("itemId", args.itemId))
          .filter((q) => q.eq(q.field("claimerId"), args.otherUserId))
          .first()) !== null;
      if (!isClaimer) {
        throw new Error("Other user is not related to this item");
      }
    }

    const participantIds = sortedParticipants(me, args.otherUserId);

    // Idempotent lookup
    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_participants_item", (q) =>
        q.eq("participantIds", participantIds).eq("itemId", args.itemId),
      )
      .first();

    if (existing) return existing._id;

    const now = Date.now();
    return await ctx.db.insert("conversations", {
      participantIds,
      itemId: args.itemId,
      claimId: args.claimId,
      lastMessageAt: now,
      lastMessagePreview: "",
      lastMessageSenderId: "",
      createdAt: now,
    });
  },
});

// ---------------------------------------------------------------------------
// sendMessage
// ---------------------------------------------------------------------------

export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const me = identity.subject;

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Not found");
    await assertParticipant(conversation.participantIds, me);

    const trimmed = args.body.trim();
    if (!trimmed) throw new Error("Message body cannot be empty");
    if (trimmed.length > 2000) throw new Error("Message body too long");

    const now = Date.now();
    const messageId = await ctx.db.insert("conversation_messages", {
      conversationId: args.conversationId,
      senderId: me,
      body: trimmed,
      type: "text",
      createdAt: now,
    });

    await ctx.db.patch(args.conversationId, {
      lastMessageAt: now,
      lastMessagePreview: trimmed.slice(0, 120),
      lastMessageSenderId: me,
    });

    // Mark as read for sender so they don't see their own message as unread
    const readRow = await ctx.db
      .query("conversation_reads")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", me).eq("conversationId", args.conversationId),
      )
      .first();

    if (readRow) {
      await ctx.db.patch(readRow._id, { lastReadAt: now });
    } else {
      await ctx.db.insert("conversation_reads", {
        conversationId: args.conversationId,
        userId: me,
        lastReadAt: now,
      });
    }

    return messageId;
  },
});

// ---------------------------------------------------------------------------
// sendSystemMessage — internal only, called by other Convex modules
// ---------------------------------------------------------------------------

export const sendSystemMessage = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    body: v.string(),
    systemEvent: v.union(
      v.literal("claim_requested"),
      v.literal("claim_approved"),
      v.literal("claim_rejected"),
      v.literal("pickup_proposed"),
      v.literal("pickup_approved"),
      v.literal("return_proposed"),
      v.literal("return_approved"),
      v.literal("picked_up"),
      v.literal("returned"),
    ),
    systemWindowStartAt: v.optional(v.number()),
    systemWindowEndAt: v.optional(v.number()),
    systemPlace: v.optional(v.string()),
    systemNote: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.insert("conversation_messages", {
      conversationId: args.conversationId,
      senderId: "system",
      body: args.body,
      type: "system",
      systemEvent: args.systemEvent,
      systemWindowStartAt: args.systemWindowStartAt,
      systemWindowEndAt: args.systemWindowEndAt,
      systemPlace: args.systemPlace,
      systemNote: args.systemNote,
      createdAt: now,
    });

    await ctx.db.patch(args.conversationId, {
      lastMessageAt: now,
      lastMessagePreview: args.body.slice(0, 120),
      lastMessageSenderId: "system",
    });
  },
});

// ---------------------------------------------------------------------------
// ensureConversationForClaim — internal helper for claim mutations
// ---------------------------------------------------------------------------

export const ensureConversationForClaim = internalMutation({
  args: {
    claimId: v.id("claims"),
  },
  handler: async (ctx, args) => {
    const claim = await ctx.db.get(args.claimId);
    if (!claim) throw new Error("Claim not found");

    const item = await ctx.db.get(claim.itemId);
    if (!item) throw new Error("Item not found");

    const participantIds = sortedParticipants(item.ownerId, claim.claimerId);

    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_participants_item", (q) =>
        q.eq("participantIds", participantIds).eq("itemId", claim.itemId),
      )
      .first();

    if (existing) return existing._id;

    const now = Date.now();
    return await ctx.db.insert("conversations", {
      participantIds,
      itemId: claim.itemId,
      claimId: claim._id,
      lastMessageAt: now,
      lastMessagePreview: "",
      lastMessageSenderId: "",
      createdAt: now,
    });
  },
});

// ---------------------------------------------------------------------------
// listMessages — paginated, newest-first
// ---------------------------------------------------------------------------

export const listMessages = query({
  args: {
    conversationId: v.id("conversations"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const me = identity.subject;

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Not found");
    await assertParticipant(conversation.participantIds, me);

    return ctx.db
      .query("conversation_messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

// ---------------------------------------------------------------------------
// listMyConversations
// ---------------------------------------------------------------------------

type ConversationListItem = {
  _id: Id<"conversations">;
  itemId: Id<"items">;
  itemName: string;
  itemImage: string | null;
  otherUser: { clerkId: string; name: string | null; avatar: string | null };
  lastMessagePreview: string;
  lastMessageAt: number;
  lastMessageSenderId: string;
  hasUnread: boolean;
};

export const listMyConversations = query({
  handler: async (ctx): Promise<ConversationListItem[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const me = identity.subject;

    // TODO: this won't scale past a few thousand conversations per user;
    // a proper solution would index by participant but Convex array-field
    // indexes don't support membership queries directly.
    const recent = await ctx.db
      .query("conversations")
      .withIndex("by_lastMessageAt")
      .order("desc")
      .take(200);

    const mine = recent.filter((c) => c.participantIds.includes(me));

    const results = await Promise.all(
      mine.map(async (c): Promise<ConversationListItem | null> => {
        const item = await ctx.db.get(c.itemId);
        if (!item) return null;

        const otherClerkId = c.participantIds.find((id) => id !== me) ?? "";
        const otherUserProfile = await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", otherClerkId))
          .first();

        const readRow = await ctx.db
          .query("conversation_reads")
          .withIndex("by_user_conversation", (q) =>
            q.eq("userId", me).eq("conversationId", c._id),
          )
          .first();

        const lastReadAt = readRow?.lastReadAt ?? 0;
        const hasUnread =
          c.lastMessageAt > lastReadAt && c.lastMessageSenderId !== me;

        const itemImage = item.imageCloudinary?.[0]?.secureUrl ?? null;

        return {
          _id: c._id,
          itemId: c.itemId,
          itemName: item.name,
          itemImage,
          otherUser: {
            clerkId: otherClerkId,
            name: otherUserProfile?.name ?? null,
            avatar: otherUserProfile?.avatarCloudinary?.secureUrl ?? null,
          },
          lastMessagePreview: c.lastMessagePreview,
          lastMessageAt: c.lastMessageAt,
          lastMessageSenderId: c.lastMessageSenderId,
          hasUnread,
        };
      }),
    );

    return results.filter((r): r is ConversationListItem => r !== null);
  },
});

export const getClaimConversationSummary = query({
  args: {
    itemId: v.id("items"),
    claimId: v.id("claims"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const me = identity.subject;

    const claim = await ctx.db.get(args.claimId);
    if (!claim) return null;
    if (claim.itemId !== args.itemId) throw new Error("Mismatch item/claim");

    const item = await ctx.db.get(args.itemId);
    if (!item) return null;
    if (me !== item.ownerId && me !== claim.claimerId) {
      throw new Error("Unauthorized");
    }

    const participantIds = sortedParticipants(item.ownerId, claim.claimerId);
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_participants_item", (q) =>
        q.eq("participantIds", participantIds).eq("itemId", args.itemId),
      )
      .filter((q) => q.eq(q.field("claimId"), args.claimId))
      .first();

    if (!conversation) return null;

    const readRow = await ctx.db
      .query("conversation_reads")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", me).eq("conversationId", conversation._id),
      )
      .first();
    const lastReadAt = readRow?.lastReadAt ?? 0;

    return {
      _id: conversation._id,
      lastMessagePreview: conversation.lastMessagePreview,
      lastMessageAt: conversation.lastMessageAt,
      lastMessageSenderId: conversation.lastMessageSenderId,
      hasUnread:
        conversation.lastMessageAt > lastReadAt &&
        conversation.lastMessageSenderId !== me,
    };
  },
});

// ---------------------------------------------------------------------------
// getConversation — for thread header
// ---------------------------------------------------------------------------

export const getConversation = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const me = identity.subject;

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Not found");
    await assertParticipant(conversation.participantIds, me);

    const item = await ctx.db.get(conversation.itemId);
    if (!item) throw new Error("Item not found");

    const otherClerkId =
      conversation.participantIds.find((id) => id !== me) ?? "";
    const otherUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", otherClerkId))
      .first();

    const itemImage = item.imageCloudinary?.[0]?.secureUrl ?? null;

    return {
      conversation,
      item: { _id: item._id, name: item.name, imageUrl: itemImage },
      otherUser: {
        clerkId: otherClerkId,
        name: otherUser?.name ?? null,
        avatar: otherUser?.avatarCloudinary?.secureUrl ?? null,
      },
    };
  },
});

// ---------------------------------------------------------------------------
// getConversationCoordination — active pickup/return plan for chat action card
// ---------------------------------------------------------------------------

export const getConversationCoordination = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const me = identity.subject;

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Not found");
    await assertParticipant(conversation.participantIds, me);

    if (!conversation.claimId) return null;

    const claim = await ctx.db.get(conversation.claimId);
    if (!claim) return null;

    const item = await ctx.db.get(claim.itemId);
    if (!item) return null;

    if (!conversation.participantIds.includes(item.ownerId)) return null;
    if (!conversation.participantIds.includes(claim.claimerId)) return null;

    const events = await ctx.db
      .query("lease_activity")
      .withIndex("by_claim_createdAt", (q) => q.eq("claimId", claim._id))
      .order("desc")
      .take(50);

    return {
      viewerRole: me === item.ownerId ? "owner" : "borrower",
      currentUserId: me,
      item: {
        _id: item._id,
        name: item.name,
        giveaway: item.giveaway,
        ownerId: item.ownerId,
        address: item.location?.address,
      },
      claim: {
        _id: claim._id,
        itemId: claim.itemId,
        claimerId: claim.claimerId,
        status: claim.status,
        startDate: claim.startDate,
        endDate: claim.endDate,
        pickedUpAt: claim.pickedUpAt,
        returnedAt: claim.returnedAt,
        transferredAt: claim.transferredAt,
        expiredAt: claim.expiredAt,
        missingAt: claim.missingAt,
      },
      pickup: {
        proposal: latestByType(events, "lease_pickup_proposed") ?? null,
        approval: latestByType(events, "lease_pickup_approved") ?? null,
      },
      return: {
        proposal: latestByType(events, "lease_return_proposed") ?? null,
        approval: latestByType(events, "lease_return_approved") ?? null,
      },
    };
  },
});

// ---------------------------------------------------------------------------
// markRead
// ---------------------------------------------------------------------------

export const markRead = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const me = identity.subject;

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Not found");
    await assertParticipant(conversation.participantIds, me);

    const now = Date.now();
    const readRow = await ctx.db
      .query("conversation_reads")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", me).eq("conversationId", args.conversationId),
      )
      .first();

    if (readRow) {
      await ctx.db.patch(readRow._id, { lastReadAt: now });
    } else {
      await ctx.db.insert("conversation_reads", {
        conversationId: args.conversationId,
        userId: me,
        lastReadAt: now,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// getUnreadSummary — nav badge
// ---------------------------------------------------------------------------

export const getUnreadSummary = query({
  handler: async (ctx): Promise<{ totalUnread: number }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const me = identity.subject;

    const recent = await ctx.db
      .query("conversations")
      .withIndex("by_lastMessageAt")
      .order("desc")
      .take(200);

    const mine = recent.filter((c) => c.participantIds.includes(me));

    let totalUnread = 0;
    for (const c of mine) {
      const readRow = await ctx.db
        .query("conversation_reads")
        .withIndex("by_user_conversation", (q) =>
          q.eq("userId", me).eq("conversationId", c._id),
        )
        .first();
      const lastReadAt = readRow?.lastReadAt ?? 0;
      if (c.lastMessageAt > lastReadAt && c.lastMessageSenderId !== me) {
        totalUnread += 1;
      }
    }

    return { totalUnread };
  },
});
