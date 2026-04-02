import type { Id } from "@/convex/_generated/dataModel";

// Cast string to Convex Id (safe for ConvexHttpClient which accepts strings at runtime)
export function asItemId(id: string) {
	return id as Id<"items">;
}

export function asClaimId(id: string) {
	return id as Id<"claims">;
}

// Schema helpers using AI SDK's jsonSchema (avoids zod dependency)
export function stringParam(description: string) {
	return { type: "string" as const, description };
}

export type ItemCategory =
	| "kitchen"
	| "furniture"
	| "electronics"
	| "clothing"
	| "books"
	| "sports"
	| "other";

const VALID_CATEGORIES = new Set<string>([
	"kitchen",
	"furniture",
	"electronics",
	"clothing",
	"books",
	"sports",
	"other",
]);

export function validateCategory(
	category: string | undefined,
): ItemCategory | undefined {
	if (!category) return undefined;
	return VALID_CATEGORIES.has(category)
		? (category as ItemCategory)
		: undefined;
}
