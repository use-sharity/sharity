import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { vCloudinaryRef } from "./mediaTypes";

const DEFAULT_SCAN_PAGE_SIZE = 100;

type CandidatePage<T> = {
  candidates: T[];
  cursor: string | null;
  isDone: boolean;
};

type StorageUrlEntry = {
  storageId: Id<"_storage">;
  url: string;
};

type CandidateRow = {
  id: string;
  storageIds: Id<"_storage">[];
  resolved: StorageUrlEntry[];
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

function getCloudinaryConfig(): CloudinaryConfig {
  return {
    cloudName: getRequiredEnv("CLOUDINARY_CLOUD_NAME"),
    apiKey: getRequiredEnv("CLOUDINARY_API_KEY"),
    apiSecret: getRequiredEnv("CLOUDINARY_API_SECRET"),
  };
}

async function sha1Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-1", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function uploadRemoteUrlToCloudinary(args: {
  config: CloudinaryConfig;
  fileUrl: string;
  folder: string;
  tags: string[];
}): Promise<{ publicId: string; secureUrl: string }> {
  const { cloudName, apiKey, apiSecret } = args.config;
  const timestamp = Math.floor(Date.now() / 1000);
  const tags = args.tags.join(",");

  // Cloudinary signature: sort params (excluding api_key and file), then SHA1(params + api_secret)
  const paramsToSign = [
    `folder=${args.folder}`,
    `tags=${tags}`,
    `timestamp=${timestamp}`,
  ].join("&");
  const signature = await sha1Hex(`${paramsToSign}${apiSecret}`);

  const formData = new FormData();
  formData.set("file", args.fileUrl);
  formData.set("api_key", apiKey);
  formData.set("timestamp", String(timestamp));
  formData.set("signature", signature);
  formData.set("folder", args.folder);
  formData.set("tags", tags);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  const data = (await response.json()) as
    | { public_id?: string; secure_url?: string; error?: { message?: string } }
    | undefined;

  if (!response.ok) {
    const message = data?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Cloudinary upload failed: ${message}`);
  }

  if (!data?.public_id || !data.secure_url) {
    throw new Error("Cloudinary upload returned missing public_id/secure_url");
  }

  return { publicId: data.public_id, secureUrl: data.secure_url };
}

export const listItemImageCandidates = internalQuery({
  args: { limit: v.number(), cursor: v.optional(v.string()) },
  handler: async (ctx, args): Promise<CandidatePage<CandidateRow>> => {
    let cursor = args.cursor ?? null;
    let isDone = false;
    const candidates: CandidateRow[] = [];

    while (!isDone && candidates.length < args.limit) {
      const page = await ctx.db
        .query("items")
        .paginate({ cursor, numItems: DEFAULT_SCAN_PAGE_SIZE });
      cursor = page.continueCursor;
      isDone = page.isDone;

      for (const row of page.page) {
        if ((row.imageStorageIds?.length ?? 0) === 0) continue;
        if ((row.imageCloudinary?.length ?? 0) !== 0) continue;

        const storageIds = row.imageStorageIds ?? [];
        const urls = await Promise.all(
          storageIds.map((id) => ctx.storage.getUrl(id)),
        );
        const resolved = storageIds
          .map((storageId, idx) => {
            const url = urls[idx];
            if (!url) return null;
            return { storageId, url };
          })
          .filter((x): x is StorageUrlEntry => x !== null);
        candidates.push({ id: row._id, storageIds, resolved });

        if (candidates.length >= args.limit) break;
      }
    }

    return { candidates, cursor, isDone };
  },
});

export const patchItemImagesMigration = internalMutation({
  args: {
    id: v.id("items"),
    imageCloudinary: v.array(vCloudinaryRef),
    remainingStorageIds: v.optional(v.array(v.id("_storage"))),
    deleteStorageIds: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, args) => {
    for (const storageId of args.deleteStorageIds ?? []) {
      await ctx.storage.delete(storageId);
    }

    await ctx.db.patch(args.id, {
      imageCloudinary: args.imageCloudinary,
      imageStorageIds: args.remainingStorageIds,
    });
  },
});

export const migrateItemImagesToCloudinary = action({
  args: {
    limit: v.optional(v.number()),
    cleanup: v.optional(v.boolean()),
    cursor: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    processed: number;
    migrated: number;
    skipped: number;
    failed: number;
    cursor: string | null;
    isDone: boolean;
  }> => {
    const cloudinaryConfig = getCloudinaryConfig();
    const limit = typeof args.limit === "number" ? args.limit : 10;
    const cleanup = Boolean(args.cleanup);

    const listResult: CandidatePage<CandidateRow> = await ctx.runQuery(
      internal.media_migrations.listItemImageCandidates,
      { limit, cursor: args.cursor },
    );
    const { candidates, cursor, isDone } = listResult;

    let processed = 0;
    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of candidates) {
      processed++;

      const uploadedRefs: { publicId: string; secureUrl: string }[] = [];
      const migratedStorageIds: Id<"_storage">[] = [];

      for (const entry of row.resolved) {
        try {
          const uploaded = await uploadRemoteUrlToCloudinary({
            config: cloudinaryConfig,
            fileUrl: entry.url,
            folder: "items",
            tags: ["migrated", "items"],
          });
          uploadedRefs.push({
            publicId: uploaded.publicId,
            secureUrl: uploaded.secureUrl,
          });
          migratedStorageIds.push(entry.storageId);
        } catch {
          failed++;
        }
      }

      if (uploadedRefs.length === 0) {
        skipped++;
        continue;
      }

      const remainingStorageIds = cleanup
        ? row.storageIds.filter((id) => !migratedStorageIds.includes(id))
        : row.storageIds;

      await ctx.runMutation(
        internal.media_migrations.patchItemImagesMigration,
        {
          id: row.id as Id<"items">,
          imageCloudinary: uploadedRefs,
          remainingStorageIds:
            remainingStorageIds.length > 0 ? remainingStorageIds : undefined,
          deleteStorageIds:
            cleanup && migratedStorageIds.length > 0
              ? migratedStorageIds
              : undefined,
        },
      );

      migrated++;
    }

    return { processed, migrated, skipped, failed, cursor, isDone };
  },
});

export const listWishlistImageCandidates = internalQuery({
  args: { limit: v.number(), cursor: v.optional(v.string()) },
  handler: async (ctx, args): Promise<CandidatePage<CandidateRow>> => {
    let cursor = args.cursor ?? null;
    let isDone = false;
    const candidates: CandidateRow[] = [];

    while (!isDone && candidates.length < args.limit) {
      const page = await ctx.db
        .query("wishlist")
        .paginate({ cursor, numItems: DEFAULT_SCAN_PAGE_SIZE });
      cursor = page.continueCursor;
      isDone = page.isDone;

      for (const row of page.page) {
        if ((row.imageStorageIds?.length ?? 0) === 0) continue;
        if ((row.imageCloudinary?.length ?? 0) !== 0) continue;

        const storageIds = row.imageStorageIds ?? [];
        const urls = await Promise.all(
          storageIds.map((id) => ctx.storage.getUrl(id)),
        );
        const resolved = storageIds
          .map((storageId, idx) => {
            const url = urls[idx];
            if (!url) return null;
            return { storageId, url };
          })
          .filter((x): x is StorageUrlEntry => x !== null);
        candidates.push({ id: row._id, storageIds, resolved });

        if (candidates.length >= args.limit) break;
      }
    }

    return { candidates, cursor, isDone };
  },
});

export const patchWishlistImagesMigration = internalMutation({
  args: {
    id: v.id("wishlist"),
    imageCloudinary: v.array(vCloudinaryRef),
    remainingStorageIds: v.optional(v.array(v.id("_storage"))),
    deleteStorageIds: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, args) => {
    for (const storageId of args.deleteStorageIds ?? []) {
      await ctx.storage.delete(storageId);
    }

    await ctx.db.patch(args.id, {
      imageCloudinary: args.imageCloudinary,
      imageStorageIds: args.remainingStorageIds,
    });
  },
});

export const migrateWishlistImagesToCloudinary = action({
  args: {
    limit: v.optional(v.number()),
    cleanup: v.optional(v.boolean()),
    cursor: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    processed: number;
    migrated: number;
    skipped: number;
    failed: number;
    cursor: string | null;
    isDone: boolean;
  }> => {
    const cloudinaryConfig = getCloudinaryConfig();
    const limit = typeof args.limit === "number" ? args.limit : 10;
    const cleanup = Boolean(args.cleanup);

    const listResult: CandidatePage<CandidateRow> = await ctx.runQuery(
      internal.media_migrations.listWishlistImageCandidates,
      { limit, cursor: args.cursor },
    );
    const { candidates, cursor, isDone } = listResult;

    let processed = 0;
    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of candidates) {
      processed++;

      const uploadedRefs: { publicId: string; secureUrl: string }[] = [];
      const migratedStorageIds: Id<"_storage">[] = [];

      for (const entry of row.resolved) {
        try {
          const uploaded = await uploadRemoteUrlToCloudinary({
            config: cloudinaryConfig,
            fileUrl: entry.url,
            folder: "wishlist",
            tags: ["migrated", "wishlist"],
          });
          uploadedRefs.push({
            publicId: uploaded.publicId,
            secureUrl: uploaded.secureUrl,
          });
          migratedStorageIds.push(entry.storageId);
        } catch {
          failed++;
        }
      }

      if (uploadedRefs.length === 0) {
        skipped++;
        continue;
      }

      const remainingStorageIds = cleanup
        ? row.storageIds.filter((id) => !migratedStorageIds.includes(id))
        : row.storageIds;

      await ctx.runMutation(
        internal.media_migrations.patchWishlistImagesMigration,
        {
          id: row.id as Id<"wishlist">,
          imageCloudinary: uploadedRefs,
          remainingStorageIds:
            remainingStorageIds.length > 0 ? remainingStorageIds : undefined,
          deleteStorageIds:
            cleanup && migratedStorageIds.length > 0
              ? migratedStorageIds
              : undefined,
        },
      );

      migrated++;
    }

    return { processed, migrated, skipped, failed, cursor, isDone };
  },
});

export const listUserAvatarCandidates = internalQuery({
  args: { limit: v.number(), cursor: v.optional(v.string()) },
  handler: async (
    ctx,
    args,
  ): Promise<
    CandidatePage<{ id: Id<"users">; storageId: Id<"_storage">; url: string }>
  > => {
    let cursor = args.cursor ?? null;
    let isDone = false;
    const candidates: {
      id: Id<"users">;
      storageId: Id<"_storage">;
      url: string;
    }[] = [];

    while (!isDone && candidates.length < args.limit) {
      const page = await ctx.db
        .query("users")
        .paginate({ cursor, numItems: DEFAULT_SCAN_PAGE_SIZE });
      cursor = page.continueCursor;
      isDone = page.isDone;

      for (const row of page.page) {
        if (!row.avatarStorageId) continue;
        if (row.avatarCloudinary) continue;
        const url = await ctx.storage.getUrl(row.avatarStorageId);
        if (!url) continue;
        candidates.push({ id: row._id, storageId: row.avatarStorageId, url });
        if (candidates.length >= args.limit) break;
      }
    }

    return { candidates, cursor, isDone };
  },
});

export const patchUserAvatarMigration = internalMutation({
  args: {
    id: v.id("users"),
    avatarCloudinary: vCloudinaryRef,
    remainingStorageId: v.optional(v.id("_storage")),
    deleteStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    if (args.deleteStorageId) {
      await ctx.storage.delete(args.deleteStorageId);
    }
    await ctx.db.patch(args.id, {
      avatarCloudinary: args.avatarCloudinary,
      avatarStorageId: args.remainingStorageId,
    });
  },
});

export const migrateUserAvatarsToCloudinary = action({
  args: {
    limit: v.optional(v.number()),
    cleanup: v.optional(v.boolean()),
    cursor: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    processed: number;
    migrated: number;
    skipped: number;
    failed: number;
    cursor: string | null;
    isDone: boolean;
  }> => {
    const cloudinaryConfig = getCloudinaryConfig();
    const limit = typeof args.limit === "number" ? args.limit : 10;
    const cleanup = Boolean(args.cleanup);

    const listResult: CandidatePage<{
      id: Id<"users">;
      storageId: Id<"_storage">;
      url: string;
    }> = await ctx.runQuery(
      internal.media_migrations.listUserAvatarCandidates,
      {
        limit,
        cursor: args.cursor,
      },
    );
    const { candidates, cursor, isDone } = listResult;

    let processed = 0;
    let migrated = 0;
    const skipped = 0;
    let failed = 0;

    for (const row of candidates) {
      processed++;
      try {
        const uploaded = await uploadRemoteUrlToCloudinary({
          config: cloudinaryConfig,
          fileUrl: row.url,
          folder: "avatars",
          tags: ["migrated", "avatars"],
        });

        await ctx.runMutation(
          internal.media_migrations.patchUserAvatarMigration,
          {
            id: row.id,
            avatarCloudinary: {
              publicId: uploaded.publicId,
              secureUrl: uploaded.secureUrl,
            },
            remainingStorageId: cleanup ? undefined : row.storageId,
            deleteStorageId: cleanup ? row.storageId : undefined,
          },
        );
        migrated++;
      } catch {
        failed++;
      }
    }

    return { processed, migrated, skipped, failed, cursor, isDone };
  },
});

export const listRatingPhotoCandidates = internalQuery({
  args: { limit: v.number(), cursor: v.optional(v.string()) },
  handler: async (ctx, args): Promise<CandidatePage<CandidateRow>> => {
    let cursor = args.cursor ?? null;
    let isDone = false;
    const candidates: CandidateRow[] = [];

    while (!isDone && candidates.length < args.limit) {
      const page = await ctx.db
        .query("ratings")
        .paginate({ cursor, numItems: DEFAULT_SCAN_PAGE_SIZE });
      cursor = page.continueCursor;
      isDone = page.isDone;

      for (const row of page.page) {
        if ((row.photoStorageIds?.length ?? 0) === 0) continue;
        if ((row.photoCloudinary?.length ?? 0) !== 0) continue;

        const storageIds = row.photoStorageIds ?? [];
        const urls = await Promise.all(
          storageIds.map((id) => ctx.storage.getUrl(id)),
        );
        const resolved = storageIds
          .map((storageId, idx) => {
            const url = urls[idx];
            if (!url) return null;
            return { storageId, url };
          })
          .filter((x): x is StorageUrlEntry => x !== null);
        candidates.push({ id: row._id, storageIds, resolved });

        if (candidates.length >= args.limit) break;
      }
    }

    return { candidates, cursor, isDone };
  },
});

export const patchRatingPhotosMigration = internalMutation({
  args: {
    id: v.id("ratings"),
    photoCloudinary: v.array(vCloudinaryRef),
    remainingStorageIds: v.optional(v.array(v.id("_storage"))),
    deleteStorageIds: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, args) => {
    for (const storageId of args.deleteStorageIds ?? []) {
      await ctx.storage.delete(storageId);
    }

    await ctx.db.patch(args.id, {
      photoCloudinary: args.photoCloudinary,
      photoStorageIds: args.remainingStorageIds,
    });
  },
});

export const migrateRatingPhotosToCloudinary = action({
  args: {
    limit: v.optional(v.number()),
    cleanup: v.optional(v.boolean()),
    cursor: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    processed: number;
    migrated: number;
    skipped: number;
    failed: number;
    cursor: string | null;
    isDone: boolean;
  }> => {
    const cloudinaryConfig = getCloudinaryConfig();
    const limit = typeof args.limit === "number" ? args.limit : 10;
    const cleanup = Boolean(args.cleanup);

    const listResult: CandidatePage<CandidateRow> = await ctx.runQuery(
      internal.media_migrations.listRatingPhotoCandidates,
      { limit, cursor: args.cursor },
    );
    const { candidates, cursor, isDone } = listResult;

    let processed = 0;
    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of candidates) {
      processed++;

      const uploadedRefs: { publicId: string; secureUrl: string }[] = [];
      const migratedStorageIds: Id<"_storage">[] = [];

      for (const entry of row.resolved) {
        try {
          const uploaded = await uploadRemoteUrlToCloudinary({
            config: cloudinaryConfig,
            fileUrl: entry.url,
            folder: "ratings",
            tags: ["migrated", "ratings"],
          });
          uploadedRefs.push({
            publicId: uploaded.publicId,
            secureUrl: uploaded.secureUrl,
          });
          migratedStorageIds.push(entry.storageId);
        } catch {
          failed++;
        }
      }

      if (uploadedRefs.length === 0) {
        skipped++;
        continue;
      }

      const remainingStorageIds = cleanup
        ? row.storageIds.filter((id) => !migratedStorageIds.includes(id))
        : row.storageIds;

      await ctx.runMutation(
        internal.media_migrations.patchRatingPhotosMigration,
        {
          id: row.id as Id<"ratings">,
          photoCloudinary: uploadedRefs,
          remainingStorageIds:
            remainingStorageIds.length > 0 ? remainingStorageIds : undefined,
          deleteStorageIds:
            cleanup && migratedStorageIds.length > 0
              ? migratedStorageIds
              : undefined,
        },
      );

      migrated++;
    }

    return { processed, migrated, skipped, failed, cursor, isDone };
  },
});

export const listLeasePhotoCandidates = internalQuery({
  args: { limit: v.number(), cursor: v.optional(v.string()) },
  handler: async (ctx, args): Promise<CandidatePage<CandidateRow>> => {
    let cursor = args.cursor ?? null;
    let isDone = false;
    const candidates: CandidateRow[] = [];

    while (!isDone && candidates.length < args.limit) {
      const page = await ctx.db
        .query("lease_activity")
        .paginate({ cursor, numItems: DEFAULT_SCAN_PAGE_SIZE });
      cursor = page.continueCursor;
      isDone = page.isDone;

      for (const row of page.page) {
        if ((row.photoStorageIds?.length ?? 0) === 0) continue;
        if ((row.photoCloudinary?.length ?? 0) !== 0) continue;

        const storageIds = row.photoStorageIds ?? [];
        const urls = await Promise.all(
          storageIds.map((id) => ctx.storage.getUrl(id)),
        );
        const resolved = storageIds
          .map((storageId, idx) => {
            const url = urls[idx];
            if (!url) return null;
            return { storageId, url };
          })
          .filter((x): x is StorageUrlEntry => x !== null);
        candidates.push({ id: row._id, storageIds, resolved });

        if (candidates.length >= args.limit) break;
      }
    }

    return { candidates, cursor, isDone };
  },
});

export const patchLeasePhotosMigration = internalMutation({
  args: {
    id: v.id("lease_activity"),
    photoCloudinary: v.array(vCloudinaryRef),
    remainingStorageIds: v.optional(v.array(v.id("_storage"))),
    deleteStorageIds: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, args) => {
    for (const storageId of args.deleteStorageIds ?? []) {
      await ctx.storage.delete(storageId);
    }

    await ctx.db.patch(args.id, {
      photoCloudinary: args.photoCloudinary,
      photoStorageIds: args.remainingStorageIds,
    });
  },
});

export const migrateLeasePhotosToCloudinary = action({
  args: {
    limit: v.optional(v.number()),
    cleanup: v.optional(v.boolean()),
    cursor: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    processed: number;
    migrated: number;
    skipped: number;
    failed: number;
    cursor: string | null;
    isDone: boolean;
  }> => {
    const cloudinaryConfig = getCloudinaryConfig();
    const limit = typeof args.limit === "number" ? args.limit : 10;
    const cleanup = Boolean(args.cleanup);

    const listResult: CandidatePage<CandidateRow> = await ctx.runQuery(
      internal.media_migrations.listLeasePhotoCandidates,
      { limit, cursor: args.cursor },
    );
    const { candidates, cursor, isDone } = listResult;

    let processed = 0;
    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of candidates) {
      processed++;

      const uploadedRefs: { publicId: string; secureUrl: string }[] = [];
      const migratedStorageIds: Id<"_storage">[] = [];

      for (const entry of row.resolved) {
        try {
          const uploaded = await uploadRemoteUrlToCloudinary({
            config: cloudinaryConfig,
            fileUrl: entry.url,
            folder: "leases",
            tags: ["migrated", "leases"],
          });
          uploadedRefs.push({
            publicId: uploaded.publicId,
            secureUrl: uploaded.secureUrl,
          });
          migratedStorageIds.push(entry.storageId);
        } catch {
          failed++;
        }
      }

      if (uploadedRefs.length === 0) {
        skipped++;
        continue;
      }

      const remainingStorageIds = cleanup
        ? row.storageIds.filter((id) => !migratedStorageIds.includes(id))
        : row.storageIds;

      await ctx.runMutation(
        internal.media_migrations.patchLeasePhotosMigration,
        {
          id: row.id as Id<"lease_activity">,
          photoCloudinary: uploadedRefs,
          remainingStorageIds:
            remainingStorageIds.length > 0 ? remainingStorageIds : undefined,
          deleteStorageIds:
            cleanup && migratedStorageIds.length > 0
              ? migratedStorageIds
              : undefined,
        },
      );

      migrated++;
    }

    return { processed, migrated, skipped, failed, cursor, isDone };
  },
});
