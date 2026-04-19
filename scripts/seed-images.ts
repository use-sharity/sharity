/**
 * Script to seed item images via Cloudinary.
 * Run with: pnpm dlx tsx scripts/seed-images.ts
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const CONVEX_URL =
  process.env.NEXT_PUBLIC_CONVEX_URL || "http://127.0.0.1:3210";

async function main() {
  console.log("🚀 Starting image seed script...\n");
  console.log(`📡 Connecting to Convex at: ${CONVEX_URL}\n`);

  const client = new ConvexHttpClient(CONVEX_URL);

  const result = await client.action(api.items.seedImages, {});
  console.log(`✅ Done. Success: ${result.success}, Failed: ${result.failed}`);
}

main().catch(console.error);
