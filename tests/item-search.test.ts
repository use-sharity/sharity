import { describe, expect, it } from "vitest";

import {
  normalizeItemSearchInput,
  ownerTokenFromName,
  parseItemSearchQuery,
  stripTrailingOwnerComma,
} from "@/lib/item-search";

describe("item search parser", () => {
  it("normalizes a leading @ into owner syntax", () => {
    expect(normalizeItemSearchInput("@ali")).toBe("owner:@ali");
    expect(parseItemSearchQuery("@ali")).toEqual({
      normalized: "owner:@ali",
      ownerQueries: ["ali"],
      itemQuery: "",
    });
  });

  it("parses multi-owner queries and item text", () => {
    expect(parseItemSearchQuery("owner:@ali,@ben drill")).toEqual({
      normalized: "owner:@ali,@ben drill",
      ownerQueries: ["ali", "ben"],
      itemQuery: "drill",
    });
  });

  it("ignores duplicates, empty tokens, and trailing commas", () => {
    expect(parseItemSearchQuery("owner:@ali,,@Ali,")).toEqual({
      normalized: "owner:@ali,,@Ali,",
      ownerQueries: ["ali"],
      itemQuery: "",
    });
  });

  it("converts generated owner tokens back into searchable words", () => {
    expect(ownerTokenFromName("Alice Smith")).toBe("alice-smith");
    expect(parseItemSearchQuery("owner:@alice-smith tent")).toEqual({
      normalized: "owner:@alice-smith tent",
      ownerQueries: ["alice smith"],
      itemQuery: "tent",
    });
  });

  it("preserves plain item search text", () => {
    expect(parseItemSearchQuery("coffee grinder")).toEqual({
      normalized: "coffee grinder",
      ownerQueries: [],
      itemQuery: "coffee grinder",
    });
  });

  it("strips trailing owner commas on dropdown close", () => {
    expect(stripTrailingOwnerComma("owner:@ali,")).toBe("owner:@ali");
    expect(stripTrailingOwnerComma("owner:@ali, drill")).toBe(
      "owner:@ali drill",
    );
  });
});
