import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { vCloudinaryRef } from "./mediaTypes";

export default defineSchema({
  items: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    searchText: v.optional(v.string()),
    ownerId: v.string(), // For MVP, we'll just store a string ID
    giveaway: v.optional(v.boolean()),
    minLeaseDays: v.optional(v.number()),
    maxLeaseDays: v.optional(v.number()),
    imageStorageIds: v.optional(v.array(v.id("_storage"))),
    imageCloudinary: v.optional(v.array(vCloudinaryRef)),
    category: v.optional(
      v.union(
        v.literal("kitchen"),
        v.literal("furniture"),
        v.literal("electronics"),
        v.literal("clothing"),
        v.literal("books"),
        v.literal("sports"),
        v.literal("other"),
      ),
    ),
    location: v.optional(
      v.object({
        lat: v.number(),
        lng: v.number(),
        address: v.optional(v.string()),
        ward: v.optional(v.string()), // Public display name (district/ward)
      }),
    ),
  })
    .index("by_owner", ["ownerId"])
    .searchIndex("search_items", {
      searchField: "searchText",
      filterFields: ["ownerId"],
    }),
  item_activity: defineTable({
    itemId: v.id("items"),
    type: v.union(
      v.literal("item_created"),
      v.literal("loan_started"),
      v.literal("item_picked_up"),
      v.literal("item_returned"),
    ),
    actorId: v.string(),
    createdAt: v.number(),
    claimId: v.optional(v.id("claims")),
    note: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    borrowerId: v.optional(v.string()),
  })
    .index("by_item", ["itemId"])
    .index("by_item_createdAt", ["itemId", "createdAt"]),
  lease_activity: defineTable({
    itemId: v.id("items"),
    claimId: v.id("claims"),
    type: v.union(
      v.literal("lease_requested"),
      v.literal("lease_approved"),
      v.literal("lease_rejected"),
      v.literal("lease_expired"),
      v.literal("lease_missing"),
      v.literal("lease_pickup_proposed"),
      v.literal("lease_pickup_approved"),
      v.literal("lease_return_proposed"),
      v.literal("lease_return_approved"),
      v.literal("lease_picked_up"),
      v.literal("lease_returned"),
      v.literal("lease_transferred"),
    ),
    actorId: v.string(),
    createdAt: v.number(),
    note: v.optional(v.string()),
    photoStorageIds: v.optional(v.array(v.id("_storage"))),
    photoCloudinary: v.optional(v.array(vCloudinaryRef)),
    proposalId: v.optional(v.string()),
    windowStartAt: v.optional(v.number()),
    windowEndAt: v.optional(v.number()),
    place: v.optional(v.string()),
  })
    .index("by_claim_createdAt", ["claimId", "createdAt"])
    .index("by_item_createdAt", ["itemId", "createdAt"])
    .index("by_type_windowEndAt", ["type", "windowEndAt"]),
  claims: defineTable({
    itemId: v.id("items"),
    claimerId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("expired"),
    ),
    startDate: v.number(),
    endDate: v.number(),
    // Temporarily optional so existing rows can be migrated safely.
    requestedAt: v.optional(v.number()),
    approvedAt: v.optional(v.number()),
    rejectedAt: v.optional(v.number()),
    pickedUpAt: v.optional(v.number()),
    returnedAt: v.optional(v.number()),
    transferredAt: v.optional(v.number()),
    expiredAt: v.optional(v.number()),
    missingAt: v.optional(v.number()),
  })
    .index("by_item", ["itemId"])
    .index("by_claimer", ["claimerId"]),
  notifications: defineTable({
    recipientId: v.string(),
    type: v.union(
      v.literal("new_request"),
      v.literal("request_approved"),
      v.literal("request_rejected"),
      v.literal("item_available"),
      v.literal("pickup_proposed"),
      v.literal("pickup_approved"),
      v.literal("pickup_confirmed"),
      v.literal("pickup_expired"),
      v.literal("return_proposed"),
      v.literal("return_approved"),
      v.literal("return_confirmed"),
      v.literal("return_missing"),
      v.literal("rate_transaction"),
      v.literal("rating_received"),
    ),
    itemId: v.id("items"),
    requestId: v.optional(v.id("claims")),
    windowStartAt: v.optional(v.number()),
    windowEndAt: v.optional(v.number()),
    isRead: v.boolean(),
    createdAt: v.number(),
  }).index("by_recipient", ["recipientId"]),
  availability_alerts: defineTable({
    itemId: v.id("items"),
    userId: v.string(),
    createdAt: v.number(),
  })
    .index("by_item", ["itemId"])
    .index("by_user_item", ["userId", "itemId"]),
  owner_unavailability: defineTable({
    ownerId: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    note: v.optional(v.string()),
  }).index("by_owner", ["ownerId"]),
  wishlist: defineTable({
    text: v.string(),
    userId: v.string(),
    votes: v.array(v.string()), // Array of userIds who voted
    createdAt: v.number(),
    imageStorageIds: v.optional(v.array(v.id("_storage"))),
    imageCloudinary: v.optional(v.array(vCloudinaryRef)),
  }).index("by_createdAt", ["createdAt"]),

  email_log: defineTable({
    key: v.string(), // e.g. "lease-approved/{claimId}"
    sentAt: v.number(),
  }).index("by_key", ["key"]),

  // User profiles (extends Clerk user data)
  users: defineTable({
    clerkId: v.string(), // Clerk user ID (identity.subject)
    email: v.optional(v.string()), // Synced from Clerk via webhook
    name: v.optional(v.string()),
    publicSearchText: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    avatarCloudinary: v.optional(vCloudinaryRef),
    address: v.optional(v.string()),
    ward: v.optional(v.string()), // Public area/ward (privacy-safe)
    bio: v.optional(v.string()), // About Me field (max 500 chars)
    contacts: v.optional(
      v.object({
        telegram: v.optional(v.string()),
        whatsapp: v.optional(v.string()),
        facebook: v.optional(v.string()),
        phone: v.optional(v.string()),
      }),
    ),
    digestFrequency: v.optional(
      v.union(v.literal("daily"), v.literal("weekly"), v.literal("off")),
    ),
    locale: v.optional(
      v.union(v.literal("en"), v.literal("vi"), v.literal("ru")),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .searchIndex("search_public_users", {
      searchField: "publicSearchText",
    }),

  // Ratings for lenders and borrowers
  ratings: defineTable({
    claimId: v.id("claims"), // Link to the lending transaction
    fromUserId: v.string(), // Who gave the rating
    toUserId: v.string(), // Who received the rating
    role: v.union(v.literal("lender"), v.literal("borrower")), // Role of the person being rated
    stars: v.number(), // 1-5 stars
    comment: v.optional(v.string()),
    photoStorageIds: v.optional(v.array(v.id("_storage"))),
    photoCloudinary: v.optional(v.array(vCloudinaryRef)),
    createdAt: v.number(),
  })
    .index("by_to_user", ["toUserId"])
    .index("by_from_user", ["fromUserId"])
    .index("by_claim", ["claimId"]),

  // Chat message history
  chat_messages: defineTable({
    userId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId", "createdAt"]),

  // Tracks when each user last cleared their chat (soft-delete marker)
  chat_cleared_at: defineTable({
    userId: v.string(),
    clearedAt: v.number(),
  }).index("by_user", ["userId"]),

  // User-to-user conversations (scoped to an item to prevent spam)
  conversations: defineTable({
    participantIds: v.array(v.string()), // Clerk user ids, sorted ascending
    itemId: v.id("items"),
    claimId: v.optional(v.id("claims")),
    lastMessageAt: v.number(),
    lastMessagePreview: v.string(),
    lastMessageSenderId: v.string(), // "system" for system messages
    createdAt: v.number(),
  })
    .index("by_participants_item", ["participantIds", "itemId"])
    .index("by_lastMessageAt", ["lastMessageAt"])
    .index("by_item", ["itemId"]),

  conversation_messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.string(), // Clerk user id, or "system"
    body: v.string(),
    type: v.union(v.literal("text"), v.literal("system")),
    systemEvent: v.optional(
      v.union(
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
    ),
    systemWindowStartAt: v.optional(v.number()),
    systemWindowEndAt: v.optional(v.number()),
    systemPlace: v.optional(v.string()),
    systemNote: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_conversation", ["conversationId", "createdAt"]),

  conversation_reads: defineTable({
    userId: v.string(),
    conversationId: v.id("conversations"),
    lastReadAt: v.number(),
  })
    .index("by_user_conversation", ["userId", "conversationId"])
    .index("by_user", ["userId"]),
});
