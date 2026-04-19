export function buildItemSearchText(args: {
  name: string;
  description?: string;
}): string {
  return [args.name, args.description].filter(Boolean).join(" ").trim();
}

export function buildUserPublicSearchText(args: {
  name?: string | null;
}): string {
  return (args.name ?? "").trim();
}
