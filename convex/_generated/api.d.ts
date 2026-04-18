/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as chat from "../chat.js";
import type * as cloudinary from "../cloudinary.js";
import type * as crons from "../crons.js";
import type * as items from "../items.js";
import type * as mediaTypes from "../mediaTypes.js";
import type * as media_migrations from "../media_migrations.js";
import type * as migrations from "../migrations.js";
import type * as notifications from "../notifications.js";
import type * as ratings from "../ratings.js";
import type * as seed from "../seed.js";
import type * as seedDemo from "../seedDemo.js";
import type * as users from "../users.js";
import type * as wishlist from "../wishlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  chat: typeof chat;
  cloudinary: typeof cloudinary;
  crons: typeof crons;
  items: typeof items;
  mediaTypes: typeof mediaTypes;
  media_migrations: typeof media_migrations;
  migrations: typeof migrations;
  notifications: typeof notifications;
  ratings: typeof ratings;
  seed: typeof seed;
  seedDemo: typeof seedDemo;
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
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
  cloudinary: import("@imaxis/cloudinary-convex/_generated/component.js").ComponentApi<"cloudinary">;
};
