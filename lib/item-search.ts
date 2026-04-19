export interface ParsedItemSearchQuery {
  normalized: string;
  ownerQueries: string[];
  itemQuery: string;
}

export function ownerTokenFromName(name: string | null | undefined): string {
  const token = (name ?? "")
    .trim()
    .toLowerCase()
    .replace(/@/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return token || "owner";
}

function ownerQueryFromToken(token: string): string {
  return token.trim().replace(/^@+/, "").replace(/[-_]+/g, " ").trim();
}

export function normalizeItemSearchInput(value: string): string {
  const trimmedStart = value.trimStart();
  const leadingWhitespace = value.slice(0, value.length - trimmedStart.length);
  if (trimmedStart.startsWith("@")) {
    return `${leadingWhitespace}owner:${trimmedStart}`;
  }
  return value;
}

export function parseItemSearchQuery(raw: string): ParsedItemSearchQuery {
  const normalized = normalizeItemSearchInput(raw).trim();
  const match = normalized.match(/^owner:([^\s]*)\s*(.*)$/i);

  if (!match) {
    return {
      normalized,
      ownerQueries: [],
      itemQuery: normalized,
    };
  }

  const seen = new Set<string>();
  const ownerQueries = match[1]
    .split(",")
    .map(ownerQueryFromToken)
    .filter((token) => {
      if (!token) return false;
      const key = token.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return {
    normalized,
    ownerQueries,
    itemQuery: match[2].trim(),
  };
}

export function stripTrailingOwnerComma(value: string): string {
  return value.replace(/^(owner:[^\s]*?),(\s|$)/i, "$1$2");
}
