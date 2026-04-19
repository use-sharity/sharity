import { describe, it, expect, vi } from "vitest";
import { buildTools } from "@/lib/sharry-tools";

// The Convex api references are opaque objects. We mock by intercepting
// all query/mutation calls and returning responses in sequence.
function createMockConvex(queryQueue: any[] = []) {
  let queryIdx = 0;
  return {
    query: vi.fn(async () => {
      const response = queryQueue[queryIdx];
      queryIdx++;
      if (response instanceof Error) throw response;
      return response ?? null;
    }),
    mutation: vi.fn(async () => {}),
    setAuth: vi.fn(),
  } as any;
}

describe("buildTools — read tools", () => {
  describe("getMyItems", () => {
    it("returns itemId for each item", async () => {
      const convex = createMockConvex([
        // api.items.getMyItems
        [
          {
            _id: "item1",
            name: "Coffee Grinder",
            description: "Great for pour over",
            category: "kitchen",
            isOwner: true,
          },
          {
            _id: "item2",
            name: "Tent",
            description: "4 person",
            category: "sports",
            isOwner: true,
          },
        ],
      ]);
      const tools = buildTools(convex, "en");
      const result = (await tools.getMyItems.execute!(
        {} as any,
        {} as any,
      )) as any;

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toHaveProperty("itemId", "item1");
      expect(result.items[0]).toHaveProperty("name", "Coffee Grinder");
      expect(result.items[0]).toHaveProperty("category", "kitchen");
      expect(result.items[1]).toHaveProperty("itemId", "item2");
      expect(result.summary).toContain("2 item(s)");
    });

    it("filters out non-owned items", async () => {
      const convex = createMockConvex([
        [
          { _id: "item1", name: "Mine", isOwner: true },
          { _id: "item2", name: "Borrowed", isOwner: false },
        ],
      ]);
      const tools = buildTools(convex, "en");
      const result = (await tools.getMyItems.execute!(
        {} as any,
        {} as any,
      )) as any;

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe("Mine");
    });

    it("returns error on failure", async () => {
      const convex = createMockConvex([new Error("Network error")]);
      const tools = buildTools(convex, "en");
      const result = await tools.getMyItems.execute!({} as any, {} as any);

      expect(result).toHaveProperty("error");
    });
  });

  describe("getMyBorrowedItems", () => {
    it("returns itemId and ownerId for each borrowed item", async () => {
      const convex = createMockConvex([
        // api.items.getMyBorrowedItems
        [
          {
            _id: "item1",
            name: "Keyboard",
            ownerId: "owner1",
            owner: { name: "Dmitry" },
            claim: {
              _id: "claim1",
              startDate: 1711929600000,
              endDate: 1711929600000,
            },
          },
        ],
      ]);
      const tools = buildTools(convex, "en");
      const result = (await tools.getMyBorrowedItems.execute!(
        {} as any,
        {} as any,
      )) as any;

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toHaveProperty("itemId", "item1");
      expect(result.items[0]).toHaveProperty("ownerId", "owner1");
      expect(result.items[0]).toHaveProperty("ownerName", "Dmitry");
      expect(result.summary).toContain("Fostering 1 item(s)");
    });
  });

  describe("browseItems", () => {
    it("returns itemId for each result", async () => {
      const convex = createMockConvex([
        // api.items.get
        [
          {
            _id: "item1",
            name: "Drill",
            description: "Cordless",
            category: "electronics",
          },
        ],
      ]);
      const tools = buildTools(convex, "en");
      const result = (await tools.browseItems.execute!(
        {} as any,
        {} as any,
      )) as any;

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toHaveProperty("itemId", "item1");
      expect(result.items[0]).toHaveProperty("name", "Drill");
    });

    it("filters by query string", async () => {
      const convex = createMockConvex([
        [
          { _id: "1", name: "Drill", category: "electronics" },
          { _id: "2", name: "Tent", category: "sports" },
        ],
      ]);
      const tools = buildTools(convex, "en");
      const result = (await tools.browseItems.execute!(
        { query: "drill" } as any,
        {} as any,
      )) as any;

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe("Drill");
    });
  });

  describe("getItemDetails", () => {
    it("returns ownerId alongside ownerName", async () => {
      const convex = createMockConvex([
        // api.items.getById
        {
          _id: "item1",
          name: "Keyboard",
          description: "Mechanical",
          category: "electronics",
          ownerId: "owner123",
          location: { address: "Da Lat" },
        },
        // api.users.getBasicInfo
        { name: "Dmitry", avatarUrl: null },
      ]);
      const tools = buildTools(convex, "en");
      const result = (await tools.getItemDetails.execute!(
        { itemId: "item1" } as any,
        {} as any,
      )) as any;

      expect(result).toHaveProperty("ownerId", "owner123");
      expect(result).toHaveProperty("ownerName", "Dmitry");
      expect(result).toHaveProperty("name", "Keyboard");
      expect(result).toHaveProperty("location", "Da Lat");
      expect(result).toHaveProperty("itemId", "item1");
    });

    it("returns error when item not found", async () => {
      const convex = createMockConvex([null]);
      const tools = buildTools(convex, "en");
      const result = await tools.getItemDetails.execute!(
        { itemId: "nonexistent" } as any,
        {} as any,
      );

      expect(result).toHaveProperty("error");
    });
  });

  describe("getClaimsOnItem", () => {
    it("returns claims with claimerId for single match", async () => {
      const convex = createMockConvex([
        // api.chat.getClaimsOnItem
        {
          found: true,
          itemName: "Coffee Grinder",
          claims: [
            {
              claimerName: "Alice",
              claimerId: "user2",
              status: "pending",
              startDate: 1711929600000,
              endDate: 1712534400000,
            },
          ],
        },
      ]);
      const tools = buildTools(convex, "en");
      const result = (await tools.getClaimsOnItem.execute!(
        { itemName: "coffee" } as any,
        {} as any,
      )) as any;

      expect(result).toHaveProperty("itemName", "Coffee Grinder");
      expect(result.claims[0]).toHaveProperty("claimerId", "user2");
    });

    it("formats multiple matches as objects with IDs, not crash", async () => {
      const convex = createMockConvex([
        {
          found: "multiple",
          items: [
            {
              itemId: "id1",
              name: "Coffee Grinder",
              category: "kitchen",
              description: "Yellow one",
            },
            {
              itemId: "id2",
              name: "Coffee Grinder",
              category: "kitchen",
              description: "Blue one",
            },
          ],
        },
      ]);
      const tools = buildTools(convex, "en");
      const result = (await tools.getClaimsOnItem.execute!(
        { itemName: "coffee" } as any,
        {} as any,
      )) as any;

      // Should NOT crash — the old code called .join() on objects
      expect(result).toHaveProperty("clarify");
      expect(result.clarify).toContain("id1");
      expect(result.clarify).toContain("id2");
      expect(result.clarify).toContain("kitchen");
    });

    it("returns error when no match", async () => {
      const convex = createMockConvex([
        {
          found: false,
          items: ["Tent", "Drill"],
        },
      ]);
      const tools = buildTools(convex, "en");
      const result = (await tools.getClaimsOnItem.execute!(
        { itemName: "keyboard" } as any,
        {} as any,
      )) as any;

      expect(result).toHaveProperty("error");
      expect(result.error).toContain("Tent");
    });
  });

  describe("getUserProfile", () => {
    it("returns rich profile data when profile exists", async () => {
      const convex = createMockConvex([
        // api.users.getProfile (Promise.all returns both at once)
        // We need to handle Promise.all — it calls query twice in parallel
      ]);
      // For Promise.all, both queries fire. Override to return in sequence.
      let callCount = 0;
      convex.query = vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          // getProfile
          return {
            name: "Dmitry",
            bio: "Sharing enthusiast",
            address: "Ward 3, Da Lat",
            availableContacts: {
              telegram: true,
              whatsapp: false,
              facebook: true,
              phone: false,
            },
            createdAt: 1700000000000,
          };
        }
        // getRatingSummary
        return { averageStars: 4.5, totalRatings: 12 };
      });
      const tools = buildTools(convex, "en");
      const result = (await tools.getUserProfile.execute!(
        { userId: "user1" } as any,
        {} as any,
      )) as any;

      expect(result).toHaveProperty("name", "Dmitry");
      expect(result).toHaveProperty("bio", "Sharing enthusiast");
      expect(result).toHaveProperty("area", "Ward 3, Da Lat");
      expect(result).toHaveProperty("averageStars", 4.5);
      expect(result).toHaveProperty("totalRatings", 12);
      expect(result.contactMethods).toContain("telegram");
      expect(result.contactMethods).toContain("facebook");
      expect(result).toHaveProperty("memberSince");
    });

    it("returns error when profile is null", async () => {
      const convex = createMockConvex([]);
      convex.query = vi.fn(async () => null);
      // Both getProfile and getRatingSummary return null
      const tools = buildTools(convex, "en");
      const result = (await tools.getUserProfile.execute!(
        { userId: "unknown" } as any,
        {} as any,
      )) as any;

      expect(result).toHaveProperty("error");
      expect(result.error).toContain("profile");
    });

    it("returns fallback values for empty fields", async () => {
      let callCount = 0;
      const convex = createMockConvex([]);
      convex.query = vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            name: null,
            bio: null,
            address: null,
            availableContacts: {
              telegram: false,
              whatsapp: false,
              facebook: false,
              phone: false,
            },
            createdAt: 1700000000000,
          };
        }
        return { averageStars: null, totalRatings: 0 };
      });
      const tools = buildTools(convex, "en");
      const result = (await tools.getUserProfile.execute!(
        { userId: "user1" } as any,
        {} as any,
      )) as any;

      // Should NOT return error — profile exists, just empty
      expect(result).not.toHaveProperty("error");
      expect(result).toHaveProperty("name", "Unknown");
      expect(result).toHaveProperty("bio", "No bio yet");
      expect(result).toHaveProperty("area", "Not specified");
      expect(result).toHaveProperty("contactMethods", "None listed");
    });
  });

  describe("getNotifications", () => {
    it("returns itemId and summary for each notification", async () => {
      const convex = createMockConvex([
        // api.notifications.get
        [
          {
            _id: "notif1",
            type: "new_request",
            isRead: false,
            itemId: "item1",
            item: { name: "Tent" },
            createdAt: 1711929600000,
          },
        ],
      ]);
      const tools = buildTools(convex, "en");
      const result = (await tools.getNotifications.execute!(
        {} as any,
        {} as any,
      )) as any;

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toHaveProperty("itemId", "item1");
      expect(result.items[0]).toHaveProperty("itemName", "Tent");
      expect(result.items[0]).toHaveProperty("markdownLink");
      expect(result.summary).toContain("1 notification(s)");
    });
  });
});
