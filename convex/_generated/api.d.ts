/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as cloudinary from "../cloudinary.js";
import type * as crons from "../crons.js";
import type * as items from "../items.js";
import type * as mediaTypes from "../mediaTypes.js";
import type * as media_migrations from "../media_migrations.js";
import type * as migrations from "../migrations.js";
import type * as notifications from "../notifications.js";
import type * as ratings from "../ratings.js";
import type * as seed from "../seed.js";
import type * as users from "../users.js";
import type * as wishlist from "../wishlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  cloudinary: typeof cloudinary;
  crons: typeof crons;
  items: typeof items;
  mediaTypes: typeof mediaTypes;
  media_migrations: typeof media_migrations;
  migrations: typeof migrations;
  notifications: typeof notifications;
  ratings: typeof ratings;
  seed: typeof seed;
  users: typeof users;
  wishlist: typeof wishlist;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  migrations: {
    lib: {
      cancel: FunctionReference<
        "mutation",
        "internal",
        { name: string },
        {
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }
      >;
      cancelAll: FunctionReference<
        "mutation",
        "internal",
        { sinceTs?: number },
        Array<{
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }>
      >;
      clearAll: FunctionReference<
        "mutation",
        "internal",
        { before?: number },
        null
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { limit?: number; names?: Array<string> },
        Array<{
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }>
      >;
      migrate: FunctionReference<
        "mutation",
        "internal",
        {
          batchSize?: number;
          cursor?: string | null;
          dryRun: boolean;
          fnHandle: string;
          name: string;
          next?: Array<{ fnHandle: string; name: string }>;
          oneBatchOnly?: boolean;
        },
        {
          batchSize?: number;
          cursor?: string | null;
          error?: string;
          isDone: boolean;
          latestEnd?: number;
          latestStart: number;
          name: string;
          next?: Array<string>;
          processed: number;
          state: "inProgress" | "success" | "failed" | "canceled" | "unknown";
        }
      >;
    };
  };
  cloudinary: {
    lib: {
      createPendingUpload: FunctionReference<
        "mutation",
        "internal",
        {
          filename?: string;
          folder?: string;
          metadata?: any;
          tags?: Array<string>;
          userId?: string;
        },
        { publicId: string; uploadId: string }
      >;
      deleteAsset: FunctionReference<
        "action",
        "internal",
        {
          config: { apiKey: string; apiSecret: string; cloudName: string };
          publicId: string;
        },
        { error?: string; success: boolean }
      >;
      deletePendingUpload: FunctionReference<
        "mutation",
        "internal",
        { uploadId: string },
        { error?: string; success: boolean }
      >;
      finalizeUpload: FunctionReference<
        "mutation",
        "internal",
        {
          folder?: string;
          publicId: string;
          uploadResult: {
            access_mode?: string;
            accessibility_analysis?: any;
            api_key?: string;
            asset_folder?: string;
            asset_id?: string;
            batch_id?: string;
            bytes?: number;
            colors?: Array<Array<any>>;
            context?: any;
            created_at?: string;
            delete_token?: string;
            display_name?: string;
            done?: boolean;
            eager?: Array<{
              bytes?: number;
              format?: string;
              height?: number;
              secure_url?: string;
              transformation?: string;
              url?: string;
              width?: number;
            }>;
            etag?: string;
            existing?: boolean;
            faces?: Array<Array<number>>;
            folder?: string;
            format: string;
            grayscale?: boolean;
            height?: number;
            illustration_score?: number;
            image_metadata?: any;
            media_metadata?: any;
            moderation?: Array<any>;
            original_extension?: string;
            original_filename?: string;
            pages?: number;
            phash?: string;
            placeholder?: boolean;
            public_id: string;
            quality_analysis?: { focus?: number };
            resource_type?: string;
            secure_url: string;
            semi_transparent?: boolean;
            signature?: string;
            status?: string;
            tags?: Array<string>;
            type?: string;
            url: string;
            version?: number;
            version_id?: string;
            width?: number;
          };
          userId?: string;
        },
        string
      >;
      generateUploadCredentials: FunctionReference<
        "action",
        "internal",
        {
          config: { apiKey: string; apiSecret: string; cloudName: string };
          filename?: string;
          folder?: string;
          publicId?: string;
          tags?: Array<string>;
          transformation?: {
            angle?: number | string;
            aspectRatio?: string | number;
            background?: string;
            border?: string;
            color?: string;
            crop?: string;
            defaultImage?: string;
            density?: number;
            dpr?: number | string;
            effect?: string;
            flags?: string | Array<string>;
            format?: string;
            gravity?: string;
            height?: number;
            namedTransformation?: string;
            opacity?: number;
            overlay?: string;
            page?: number;
            quality?: string | number;
            radius?: number | string;
            rawTransformation?: string;
            width?: number;
            x?: number;
            y?: number;
            zoom?: number;
          };
          userId?: string;
        },
        {
          uploadParams: {
            api_key: string;
            folder?: string;
            public_id?: string;
            signature: string;
            tags?: string;
            timestamp: string;
            transformation?: string;
          };
          uploadUrl: string;
        }
      >;
      getAsset: FunctionReference<
        "query",
        "internal",
        {
          config: { apiKey: string; apiSecret: string; cloudName: string };
          publicId: string;
        },
        {
          _creationTime: number;
          _id: string;
          bytes?: number;
          cloudinaryUrl: string;
          errorMessage?: string;
          folder?: string;
          format: string;
          height?: number;
          metadata?: any;
          originalFilename?: string;
          publicId: string;
          secureUrl: string;
          status: "pending" | "uploading" | "completed" | "failed";
          tags?: Array<string>;
          transformations?: Array<any>;
          updatedAt: number;
          uploadedAt: number;
          userId?: string;
          width?: number;
        } | null
      >;
      getUploadsByStatus: FunctionReference<
        "query",
        "internal",
        {
          limit?: number;
          status: "pending" | "uploading" | "completed" | "failed";
          userId?: string;
        },
        Array<{
          _creationTime: number;
          _id: string;
          bytes?: number;
          cloudinaryUrl: string;
          errorMessage?: string;
          folder?: string;
          format: string;
          height?: number;
          metadata?: any;
          originalFilename?: string;
          publicId: string;
          secureUrl: string;
          status: "pending" | "uploading" | "completed" | "failed";
          tags?: Array<string>;
          transformations?: Array<any>;
          updatedAt: number;
          uploadedAt: number;
          userId?: string;
          width?: number;
        }>
      >;
      listAssets: FunctionReference<
        "query",
        "internal",
        {
          config: { apiKey: string; apiSecret: string; cloudName: string };
          folder?: string;
          limit?: number;
          order?: "asc" | "desc";
          orderBy?: "uploadedAt" | "updatedAt";
          tags?: Array<string>;
          userId?: string;
        },
        Array<{
          _creationTime: number;
          _id: string;
          bytes?: number;
          cloudinaryUrl: string;
          errorMessage?: string;
          folder?: string;
          format: string;
          height?: number;
          metadata?: any;
          originalFilename?: string;
          publicId: string;
          secureUrl: string;
          status: "pending" | "uploading" | "completed" | "failed";
          tags?: Array<string>;
          transformations?: Array<any>;
          updatedAt: number;
          uploadedAt: number;
          userId?: string;
          width?: number;
        }>
      >;
      transform: FunctionReference<
        "query",
        "internal",
        {
          config: { apiKey: string; apiSecret: string; cloudName: string };
          publicId: string;
          transformation: {
            angle?: number | string;
            aspectRatio?: string | number;
            background?: string;
            border?: string;
            color?: string;
            crop?: string;
            defaultImage?: string;
            density?: number;
            dpr?: number | string;
            effect?: string;
            flags?: string | Array<string>;
            format?: string;
            gravity?: string;
            height?: number;
            namedTransformation?: string;
            opacity?: number;
            overlay?: string;
            page?: number;
            quality?: string | number;
            radius?: number | string;
            rawTransformation?: string;
            width?: number;
            x?: number;
            y?: number;
            zoom?: number;
          };
        },
        { secureUrl: string; transformedUrl: string }
      >;
      updateAsset: FunctionReference<
        "mutation",
        "internal",
        { metadata?: any; publicId: string; tags?: Array<string> },
        {
          _creationTime: number;
          _id: string;
          bytes?: number;
          cloudinaryUrl: string;
          errorMessage?: string;
          folder?: string;
          format: string;
          height?: number;
          metadata?: any;
          originalFilename?: string;
          publicId: string;
          secureUrl: string;
          status: "pending" | "uploading" | "completed" | "failed";
          tags?: Array<string>;
          transformations?: Array<any>;
          updatedAt: number;
          uploadedAt: number;
          userId?: string;
          width?: number;
        } | null
      >;
      updateUploadStatus: FunctionReference<
        "mutation",
        "internal",
        {
          bytes?: number;
          cloudinaryUrl?: string;
          errorMessage?: string;
          format?: string;
          height?: number;
          publicId?: string;
          secureUrl?: string;
          status: "pending" | "uploading" | "completed" | "failed";
          uploadId: string;
          width?: number;
        },
        {
          _creationTime: number;
          _id: string;
          bytes?: number;
          cloudinaryUrl: string;
          errorMessage?: string;
          folder?: string;
          format: string;
          height?: number;
          metadata?: any;
          originalFilename?: string;
          publicId: string;
          secureUrl: string;
          status: "pending" | "uploading" | "completed" | "failed";
          tags?: Array<string>;
          transformations?: Array<any>;
          updatedAt: number;
          uploadedAt: number;
          userId?: string;
          width?: number;
        } | null
      >;
      upload: FunctionReference<
        "action",
        "internal",
        {
          base64Data: string;
          config: { apiKey: string; apiSecret: string; cloudName: string };
          filename?: string;
          folder?: string;
          publicId?: string;
          tags?: Array<string>;
          transformation?: {
            angle?: number | string;
            aspectRatio?: string | number;
            background?: string;
            border?: string;
            color?: string;
            crop?: string;
            defaultImage?: string;
            density?: number;
            dpr?: number | string;
            effect?: string;
            flags?: string | Array<string>;
            format?: string;
            gravity?: string;
            height?: number;
            namedTransformation?: string;
            opacity?: number;
            overlay?: string;
            page?: number;
            quality?: string | number;
            radius?: number | string;
            rawTransformation?: string;
            width?: number;
            x?: number;
            y?: number;
            zoom?: number;
          };
          userId?: string;
        },
        {
          bytes?: number;
          error?: string;
          format?: string;
          height?: number;
          publicId?: string;
          secureUrl?: string;
          success: boolean;
          width?: number;
        }
      >;
    };
  };
};
