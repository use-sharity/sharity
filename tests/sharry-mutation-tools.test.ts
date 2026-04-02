import { describe, it, expect, vi } from "vitest";
import { buildMutationTools } from "@/lib/sharry-mutation-tools";

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

describe("resolveOwned (tested via mutation tools)", () => {
	describe("deleteItem — single match", () => {
		it("resolves by name and deletes", async () => {
			const convex = createMockConvex([
				// resolveMyItem query
				{
					found: true,
					itemId: "item1",
					itemName: "Coffee Grinder",
					claims: [],
				},
			]);
			const tools = buildMutationTools(convex, "en");
			const result = (await tools.deleteItem.execute(
				{ itemName: "coffee" } as any,
				{} as any,
			)) as any;

			expect(result).toHaveProperty("success");
			expect(result.success).toContain("Coffee Grinder");
			expect(convex.mutation).toHaveBeenCalled();
		});
	});

	describe("deleteItem — multiple matches", () => {
		it("returns disambiguation with IDs and categories", async () => {
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
			const tools = buildMutationTools(convex, "en");
			const result = (await tools.deleteItem.execute(
				{ itemName: "coffee" } as any,
				{} as any,
			)) as any;

			expect(result).toHaveProperty("error");
			expect(result.error).toContain("id1");
			expect(result.error).toContain("id2");
			expect(result.error).toContain("kitchen");
			expect(result.error).toContain("Yellow one");
			expect(convex.mutation).not.toHaveBeenCalled();
		});
	});

	describe("deleteItem — no match", () => {
		it("returns error with available item names", async () => {
			const convex = createMockConvex([
				{
					found: false,
					items: ["Tent", "Drill"],
				},
			]);
			const tools = buildMutationTools(convex, "en");
			const result = (await tools.deleteItem.execute(
				{ itemName: "keyboard" } as any,
				{} as any,
			)) as any;

			expect(result).toHaveProperty("error");
			expect(result.error).toContain("Tent");
			expect(result.error).toContain("Drill");
			expect(convex.mutation).not.toHaveBeenCalled();
		});
	});

	describe("deleteItem — direct itemId bypass", () => {
		it("fetches claims by ID and deletes", async () => {
			const convex = createMockConvex([
				// resolveMyItemById query
				{
					itemId: "direct-id-123",
					itemName: "Coffee Grinder",
					claims: [],
				},
			]);
			const tools = buildMutationTools(convex, "en");
			const result = (await tools.deleteItem.execute(
				{ itemName: "coffee", itemId: "direct-id-123" } as any,
				{} as any,
			)) as any;

			expect(result).toHaveProperty("success");
			// Should have called resolveMyItemById query
			expect(convex.query).toHaveBeenCalled();
			// Should have called deleteItem mutation with the direct ID
			expect(convex.mutation).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ id: "direct-id-123" }),
			);
		});
	});

	describe("deleteItem — unauthenticated", () => {
		it("returns sign-in error when resolveMyItem returns null", async () => {
			const convex = createMockConvex([null]);
			const tools = buildMutationTools(convex, "en");
			const result = (await tools.deleteItem.execute(
				{ itemName: "coffee" } as any,
				{} as any,
			)) as any;

			expect(result).toHaveProperty("error");
			expect(result.error).toContain("Sign in");
		});
	});

	describe("updateItem — uses itemId when provided", () => {
		it("passes itemId through to resolveOwned", async () => {
			const convex = createMockConvex([
				// resolveMyItemById query
				{
					itemId: "specific-id",
					itemName: "Grinder",
					claims: [],
				},
			]);
			const tools = buildMutationTools(convex, "en");
			const result = (await tools.updateItem.execute(
				{
					itemName: "grinder",
					itemId: "specific-id",
					name: "Better Grinder",
				} as any,
				{} as any,
			)) as any;

			expect(result).toHaveProperty("success");
			expect(convex.query).toHaveBeenCalled();
			expect(convex.mutation).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({
					id: "specific-id",
					name: "Better Grinder",
				}),
			);
		});
	});

	describe("approveClaim — single pending claim", () => {
		it("approves when one pending claim exists", async () => {
			const convex = createMockConvex([
				{
					found: true,
					itemId: "item1",
					itemName: "Tent",
					claims: [
						{
							claimId: "claim1",
							claimerName: "Alice",
							claimerId: "user2",
							status: "pending",
							startDate: 1711929600000,
							endDate: 1712534400000,
						},
					],
				},
			]);
			const tools = buildMutationTools(convex, "en");
			const result = (await tools.approveClaim.execute(
				{ itemName: "tent" } as any,
				{} as any,
			)) as any;

			expect(result).toHaveProperty("success");
			expect(result.success).toContain("Alice");
			expect(convex.mutation).toHaveBeenCalled();
		});
	});

	describe("createItem", () => {
		it("creates item and returns link", async () => {
			const convex = createMockConvex([
				// resolveMyItem (called after create to get ID)
				{
					found: true,
					itemId: "new-item-id",
					itemName: "Blender",
				},
			]);
			const tools = buildMutationTools(convex, "en");
			const result = (await tools.createItem.execute(
				{
					name: "Blender",
					description: "High speed",
					category: "kitchen",
				} as any,
				{} as any,
			)) as any;

			expect(result).toHaveProperty("success");
			expect(result.success).toContain("Blender");
			expect(result.nextStep).toContain("/en/item/new-item-id");
		});
	});
});
