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
import type * as emailSend from "../emailSend.js";
import type * as emailTemplates__shared from "../emailTemplates/_shared.js";
import type * as emailTemplates_dailyDigest from "../emailTemplates/dailyDigest.js";
import type * as emailTemplates_index from "../emailTemplates/index.js";
import type * as emailTemplates_itemAvailable from "../emailTemplates/itemAvailable.js";
import type * as emailTemplates_leaseApproved from "../emailTemplates/leaseApproved.js";
import type * as emailTemplates_meetupConfirmed from "../emailTemplates/meetupConfirmed.js";
import type * as emailTemplates_meetupProposed from "../emailTemplates/meetupProposed.js";
import type * as emailTemplates_newRequest from "../emailTemplates/newRequest.js";
import type * as emailTemplates_overdueAlert from "../emailTemplates/overdueAlert.js";
import type * as emailTemplates_requestRejected from "../emailTemplates/requestRejected.js";
import type * as emailTemplates_welcome from "../emailTemplates/welcome.js";
import type * as emails from "../emails.js";
import type * as http from "../http.js";
import type * as items from "../items.js";
import type * as mediaTypes from "../mediaTypes.js";
import type * as media_migrations from "../media_migrations.js";
import type * as migrations from "../migrations.js";
import type * as notifications from "../notifications.js";
import type * as ratings from "../ratings.js";
import type * as resendClient from "../resendClient.js";
import type * as seed from "../seed.js";
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
  emailSend: typeof emailSend;
  "emailTemplates/_shared": typeof emailTemplates__shared;
  "emailTemplates/dailyDigest": typeof emailTemplates_dailyDigest;
  "emailTemplates/index": typeof emailTemplates_index;
  "emailTemplates/itemAvailable": typeof emailTemplates_itemAvailable;
  "emailTemplates/leaseApproved": typeof emailTemplates_leaseApproved;
  "emailTemplates/meetupConfirmed": typeof emailTemplates_meetupConfirmed;
  "emailTemplates/meetupProposed": typeof emailTemplates_meetupProposed;
  "emailTemplates/newRequest": typeof emailTemplates_newRequest;
  "emailTemplates/overdueAlert": typeof emailTemplates_overdueAlert;
  "emailTemplates/requestRejected": typeof emailTemplates_requestRejected;
  "emailTemplates/welcome": typeof emailTemplates_welcome;
  emails: typeof emails;
  http: typeof http;
  items: typeof items;
  mediaTypes: typeof mediaTypes;
  media_migrations: typeof media_migrations;
  migrations: typeof migrations;
  notifications: typeof notifications;
  ratings: typeof ratings;
  resendClient: typeof resendClient;
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
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
  cloudinary: import("@imaxis/cloudinary-convex/_generated/component.js").ComponentApi<"cloudinary">;
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
};
