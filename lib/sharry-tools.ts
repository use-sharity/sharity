import { tool } from "ai";
import type { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";

// Helper: cast string to Convex Id (safe for ConvexHttpClient which accepts strings at runtime)
function asId<T extends string>(id: string) {
	return id as unknown as Id<T>;
}

export function buildTools(convex: ConvexHttpClient, locale: string) {
	return {
		getMyItems: tool({
			description:
				"List the user's own items with descriptions and categories. Use when the user asks about their listed items.",
			parameters: z.object({}),
			execute: async () => {
				try {
					const items = await convex.query(api.items.getMyItems);
					return items
						.filter((i) => i.isOwner)
						.map((i) => ({
							name: i.name,
							description: i.description ?? "",
							category: i.category ?? "other",
						}));
				} catch {
					return { error: "Could not fetch your items right now." };
				}
			},
		}),
	};
}
