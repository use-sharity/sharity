import { jsonSchema, tool } from "ai";
import type { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { buildMutationTools } from "@/lib/sharry-mutation-tools";
import type { CloudinaryRef } from "@/lib/cloudinary-ref";
import { asClaimId, asItemId, stringParam } from "@/lib/sharry-tool-utils";

const noParams = jsonSchema<Record<string, never>>({
  type: "object",
  properties: {},
});

export function mdLink(text: string, path: string, locale: string) {
  return `[${text}](/${locale}${path})`;
}

export function itemMdLink(name: string, id: string, locale: string) {
  return mdLink(name, `/item/${id}`, locale);
}

export function userMdLink(name: string, userId: string, locale: string) {
  return mdLink(name, `/user/${userId}`, locale);
}

export function pageMdLink(name: string, page: string, locale: string) {
  const paths: Record<string, string> = {
    "my-items": "/my-items",
    wishlist: "/wishlist",
    profile: "/profile",
    notifications: "/notifications",
  };
  return mdLink(name, paths[page] ?? `/${page}`, locale);
}

export function buildTools(
  convex: ConvexHttpClient,
  locale: string,
  attachedImageRefs: CloudinaryRef[] = [],
) {
  const itemLink = (name: string, id: string) =>
    mdLink(name, `/item/${id}`, locale);
  return {
    getMyItems: tool({
      description:
        "List the user's own items with descriptions and categories. Use when the user asks about their listed items. IMPORTANT: Copy the 'summary' field into your response — it contains clickable links.",
      inputSchema: noParams,
      execute: async () => {
        try {
          const items = await convex.query(api.items.getMyItems);
          const results = items
            .filter((i) => i.isOwner)
            .map((i) => ({
              itemId: i._id,
              name: i.name,
              description: i.description ?? "",
              category: i.category ?? "other",
              mode: i.giveaway ? "giveaway" : "lending",
              minLeaseDays: i.minLeaseDays ?? null,
              maxLeaseDays: i.maxLeaseDays ?? null,
              location: i.location?.address ?? null,
              markdownLink: itemLink(i.name, i._id),
            }));
          if (results.length === 0)
            return { items: [], summary: "You have no items listed yet." };
          const lines = results.map(
            (r) => `- ${r.markdownLink} (${r.category}, ${r.mode})`,
          );
          return {
            items: results,
            summary: `Your ${results.length} item(s):\n${lines.join("\n")}`,
          };
        } catch (e) {
          console.error("getMyItems failed:", e);
          return { error: "Could not fetch your items right now." };
        }
      },
    }),

    getMyBorrowedItems: tool({
      description:
        "List items the user ALREADY has — currently fostering from other neighbors, with owner name and return dates. Use ONLY when the user asks what they currently have or need to return. Do NOT use when the user wants to find/borrow something new — use browseItems instead. IMPORTANT: Copy the 'summary' field into your response.",
      inputSchema: noParams,
      execute: async () => {
        try {
          const items = await convex.query(api.items.getMyBorrowedItems);
          const results = items.map((i) => ({
            itemId: i._id,
            name: i.name,
            description: i.description ?? "",
            category: i.category ?? "other",
            mode: i.giveaway ? "giveaway" : "lending",
            claimId: i.claim._id,
            ownerId: i.ownerId,
            ownerName: i.owner.name ?? "a neighbor",
            startDate: new Date(i.claim.startDate).toLocaleDateString(locale),
            endDate: new Date(i.claim.endDate).toLocaleDateString(locale),
            pickedUpAt: i.claim.pickedUpAt
              ? new Date(i.claim.pickedUpAt).toLocaleDateString(locale)
              : null,
            markdownLink: itemLink(i.name, i._id),
          }));
          if (results.length === 0)
            return {
              items: [],
              summary: "You're not fostering any items right now.",
            };
          const lines = results.map(
            (r) =>
              `- ${r.markdownLink} from ${r.ownerName} (${r.startDate} – ${r.endDate})`,
          );
          return {
            items: results,
            summary: `Fostering ${results.length} item(s):\n${lines.join("\n")}`,
          };
        } catch (e) {
          console.error("getMyBorrowedItems failed:", e);
          return { error: "Could not fetch your borrowed items right now." };
        }
      },
    }),

    browseItems: tool({
      description:
        "Search available items from other neighbors. Filter by name/keyword and/or category. Use when the user wants to FIND or BORROW something new (e.g. 'I need a drill', 'lets borrow iron', 'find me a tent'). This is the go-to tool for any request to get/borrow/find an item. IMPORTANT: Copy the 'summary' field into your response — it contains clickable markdown links.",
      inputSchema: jsonSchema<{ query?: string; category?: string }>({
        type: "object",
        properties: {
          query: stringParam("Search term to match against item names"),
          category: stringParam(
            "Category: kitchen, furniture, electronics, clothing, books, sports, other",
          ),
        },
      }),
      execute: async ({ query, category }) => {
        try {
          let items = await convex.query(api.items.get);
          if (query) {
            const q = query.toLowerCase();
            items = items.filter(
              (i) =>
                i.name.toLowerCase().includes(q) ||
                (i.description ?? "").toLowerCase().includes(q),
            );
          }
          if (category) {
            items = items.filter((i) => i.category === category);
          }
          const results = items.slice(0, 10).map((i) => ({
            itemId: i._id,
            name: i.name,
            description: i.description ?? "",
            category: i.category ?? "other",
            mode: i.giveaway ? "giveaway" : "lending",
            ward: i.location?.ward ?? null,
            minLeaseDays: i.minLeaseDays ?? null,
            maxLeaseDays: i.maxLeaseDays ?? null,
            markdownLink: itemLink(i.name, i._id),
          }));
          if (results.length === 0)
            return { items: [], summary: "No items found." };
          const lines = results.map(
            (r) => `- ${r.markdownLink} — ${r.description || r.category}`,
          );
          return {
            items: results,
            summary: `Found ${results.length} item(s):\n${lines.join("\n")}`,
          };
        } catch (e) {
          console.error("browseItems failed:", e);
          return { error: "Could not search items right now." };
        }
      },
    }),

    getItemDetails: tool({
      description:
        "Get full details of a specific item by ID: description, category, owner name, location. Use after browseItems to learn more.",
      inputSchema: jsonSchema<{ itemId: string }>({
        type: "object",
        properties: {
          itemId: stringParam("The item ID from browseItems results"),
        },
        required: ["itemId"],
      }),
      execute: async ({ itemId }) => {
        try {
          const item = await convex.query(api.items.getById, {
            id: asItemId(itemId),
          });
          if (!item) return { error: "Item not found." };
          const ownerInfo = await convex.query(api.users.getBasicInfo, {
            userId: item.ownerId,
          });
          return {
            itemId,
            name: item.name,
            description: item.description ?? "",
            category: item.category ?? "other",
            mode: item.giveaway ? "giveaway" : "lending",
            ownerId: item.ownerId,
            ownerName: ownerInfo.name ?? "a neighbor",
            location: item.location?.address ?? null,
            ward: item.location?.ward ?? null,
            minLeaseDays: item.minLeaseDays ?? null,
            maxLeaseDays: item.maxLeaseDays ?? null,
            markdownLink: itemLink(item.name, itemId),
          };
        } catch (e) {
          console.error("getItemDetails failed:", e);
          return { error: "Could not fetch item details right now." };
        }
      },
    }),

    getItemAvailability: tool({
      description:
        "Get the availability calendar for an item — which date ranges are booked vs free. Also suggests the next free window after today.",
      inputSchema: jsonSchema<{ itemId: string }>({
        type: "object",
        properties: { itemId: stringParam("The item ID") },
        required: ["itemId"],
      }),
      execute: async ({ itemId }) => {
        try {
          const ranges = await convex.query(api.items.getAvailability, {
            id: asItemId(itemId),
          });
          if (ranges.length === 0)
            return {
              available: "fully available",
              summary: "This item is fully available — no bookings.",
            };
          const bookedRanges = ranges.map((r) => ({
            from: new Date(r.startDate).toLocaleDateString(locale),
            to: new Date(r.endDate).toLocaleDateString(locale),
            fromTs: r.startDate,
            toTs: r.endDate,
          }));
          // Find next free window after today
          const now = Date.now();
          const futureRanges = ranges
            .filter((r) => r.endDate > now)
            .sort((a, b) => a.startDate - b.startDate);
          let nextFree: string | null = null;
          if (futureRanges.length > 0) {
            // Check if there's a gap before the first future booking
            if (futureRanges[0].startDate > now) {
              nextFree = `Available now until ${new Date(futureRanges[0].startDate).toLocaleDateString(locale)}`;
            } else {
              // Find the first gap between bookings
              for (let i = 0; i < futureRanges.length; i++) {
                const gapStart = futureRanges[i].endDate;
                const gapEnd =
                  i + 1 < futureRanges.length
                    ? futureRanges[i + 1].startDate
                    : null;
                if (!gapEnd || gapEnd > gapStart) {
                  nextFree = `Next available from ${new Date(gapStart).toLocaleDateString(locale)}`;
                  break;
                }
              }
            }
          }
          const lines = bookedRanges.map(
            (r) => `- Booked: ${r.from} – ${r.to}`,
          );
          if (nextFree) lines.push(`\n${nextFree}`);
          return {
            bookedRanges: bookedRanges.map(({ from, to }) => ({
              from,
              to,
            })),
            nextFreeWindow: nextFree,
            summary: `${bookedRanges.length} booked period(s):\n${lines.join("\n")}`,
          };
        } catch (e) {
          console.error("getItemAvailability failed:", e);
          return { error: "Could not fetch availability right now." };
        }
      },
    }),

    getMyCalendar: tool({
      description:
        "Get the user's schedule for a date range — items they're lending, fostering, and vacation blocks. Use when the user asks about their schedule, upcoming events, or what's happening on specific dates. IMPORTANT: Copy the 'summary' field into your response.",
      inputSchema: jsonSchema<{ startDate: string; endDate: string }>({
        type: "object",
        properties: {
          startDate: stringParam(
            "Start of range (ISO format, e.g., 2026-04-01)",
          ),
          endDate: stringParam("End of range (ISO format, e.g., 2026-04-07)"),
        },
        required: ["startDate", "endDate"],
      }),
      execute: async ({ startDate, endDate }) => {
        try {
          const start = new Date(startDate).getTime();
          const end = new Date(endDate).getTime();
          if (isNaN(start) || isNaN(end))
            return {
              error: "Could not parse dates. Use format like '2026-04-01'.",
            };
          const events = await convex.query(api.items.getCalendarEvents, {
            startDate: start,
            endDate: end,
          });
          if (events.length === 0)
            return {
              items: [],
              summary: `Nothing scheduled from ${startDate} to ${endDate}.`,
            };
          const results = events.map((e) => ({
            type: e.type,
            title: e.title,
            startDate: new Date(e.startDate).toLocaleDateString(locale),
            endDate: new Date(e.endDate).toLocaleDateString(locale),
            isAllDay: e.isAllDay,
            itemId: e.itemId ?? null,
            claimId: e.claimId ?? null,
            needsAction: e.needsAction ?? null,
            counterpartyName: e.counterpartyName ?? null,
            vacationNote: e.vacationNote ?? null,
            markdownLink: e.itemId ? itemLink(e.title, e.itemId) : null,
          }));
          const lines = results.map((r) => {
            const action = r.needsAction
              ? ` ⚠ ${r.needsAction.replace(/_/g, " ")}`
              : "";
            const link = r.markdownLink ?? `**${r.title}**`;
            return `- ${r.startDate} – ${r.endDate}: ${link} (${r.type})${action}`;
          });
          return {
            items: results,
            summary: `Schedule (${results.length} event(s)):\n${lines.join("\n")}`,
          };
        } catch (e) {
          console.error("getMyCalendar failed:", e);
          return { error: "Could not fetch your calendar right now." };
        }
      },
    }),

    getMyBlockedDates: tool({
      description:
        "Get the user's vacation/unavailability blocks. Use when the user asks when they're marked as unavailable, or before unblocking dates. IMPORTANT: Copy the 'summary' field into your response.",
      inputSchema: noParams,
      execute: async () => {
        try {
          const ranges = await convex.query(api.items.getOwnerUnavailability);
          if (ranges.length === 0)
            return {
              items: [],
              summary: "You have no blocked dates.",
            };
          const results = ranges.map((r) => ({
            blockId: r._id,
            startDate: new Date(r.startDate).toLocaleDateString(locale),
            endDate: new Date(r.endDate).toLocaleDateString(locale),
            note: r.note ?? null,
          }));
          const lines = results.map((r) => {
            const note = r.note ? ` — ${r.note}` : "";
            return `- ${r.startDate} – ${r.endDate}${note}`;
          });
          return {
            items: results,
            summary: `${results.length} blocked period(s):\n${lines.join("\n")}`,
          };
        } catch (e) {
          console.error("getMyBlockedDates failed:", e);
          return {
            error: "Could not fetch your blocked dates right now.",
          };
        }
      },
    }),

    getLeaseTimeline: tool({
      description:
        "Get the full activity timeline for a specific rental/claim — pickup proposals, approvals, status changes. Use when the user asks what happened with a rental or needs to understand where things stand.",
      inputSchema: jsonSchema<{ claimId: string }>({
        type: "object",
        properties: {
          claimId: stringParam(
            "The claim ID from getClaimsOnItem or getMyBorrowedItems",
          ),
        },
        required: ["claimId"],
      }),
      execute: async ({ claimId }) => {
        try {
          const events = await convex.query(api.items.getLeaseActivity, {
            claimId: asClaimId(claimId),
          });
          if (!events || events.length === 0)
            return {
              items: [],
              summary: "No activity found for this rental.",
            };
          const results = events.map((e) => ({
            type: e.type.replace(/^lease_/, "").replace(/_/g, " "),
            createdAt: new Date(e.createdAt).toLocaleDateString(locale),
            note: e.note ?? null,
            windowStart: e.windowStartAt
              ? new Date(e.windowStartAt).toLocaleString(locale)
              : null,
            windowEnd: e.windowEndAt
              ? new Date(e.windowEndAt).toLocaleString(locale)
              : null,
          }));
          const lines = results.map((r) => {
            const window = r.windowStart
              ? ` (${r.windowStart} – ${r.windowEnd})`
              : "";
            const note = r.note ? ` — ${r.note}` : "";
            return `- ${r.createdAt}: **${r.type}**${window}${note}`;
          });
          return {
            items: results,
            summary: `Timeline (${results.length} event(s)):\n${lines.join("\n")}`,
          };
        } catch (e) {
          console.error("getLeaseTimeline failed:", e);
          return {
            error: "Could not fetch the rental timeline right now.",
          };
        }
      },
    }),

    getClaimsOnItem: tool({
      description:
        "Look up who has requested or is fostering a specific item owned by the user. Takes an item name (partial match OK).",
      inputSchema: jsonSchema<{ itemName: string }>({
        type: "object",
        properties: { itemName: stringParam("Name of the user's item") },
        required: ["itemName"],
      }),
      execute: async ({ itemName }) => {
        try {
          const result = await convex.query(api.chat.getClaimsOnItem, {
            itemName,
          });
          if (!result) return { error: "Sign in to see your items." };
          if (result.found === false) {
            return {
              error: `No item matching "${itemName}". Your items: ${result.items.join(", ")}`,
            };
          }
          if (result.found === "multiple") {
            const descriptions = result.items
              .map(
                (i: {
                  name: string;
                  category: string;
                  description?: string;
                  itemId: string;
                }) =>
                  `"${i.name}" (${i.category}${i.description ? `, ${i.description.slice(0, 60)}` : ""}) — ID: ${i.itemId}`,
              )
              .join("\n");
            return {
              clarify: `Multiple items match:\n${descriptions}\nWhich one?`,
            };
          }
          return {
            itemName: result.itemName,
            claims: result.claims.map((c) => ({
              claimId: c.claimId,
              claimerName: c.claimerName,
              claimerId: c.claimerId,
              status: c.status,
              startDate: new Date(c.startDate).toLocaleDateString(locale),
              endDate: new Date(c.endDate).toLocaleDateString(locale),
            })),
          };
        } catch (e) {
          console.error("getClaimsOnItem failed:", e);
          return { error: "Could not look up claims right now." };
        }
      },
    }),

    getUserProfile: tool({
      description:
        "Get public profile info, bio, contact methods, and rating summary for a user by their userId. ALWAYS call this before making claims about a user's profile, ratings, or activity level. Use the ownerId from getItemDetails or getMyBorrowedItems.",
      inputSchema: jsonSchema<{ userId: string }>({
        type: "object",
        properties: { userId: stringParam("The user ID to look up") },
        required: ["userId"],
      }),
      execute: async ({ userId }) => {
        try {
          const [profile, ratings] = await Promise.all([
            convex.query(api.users.getProfile, { userId }),
            convex.query(api.ratings.getRatingSummary, { userId }),
          ]);
          if (!profile) {
            return {
              error: "This neighbor hasn't set up their profile yet.",
            };
          }
          const contacts = profile.availableContacts;
          const contactMethods = Object.entries(contacts)
            .filter(([, v]) => v)
            .map(([k]) => k);
          const profileLink = mdLink(
            profile.name ?? "View profile",
            `/user/${userId}`,
            locale,
          );
          return {
            name: profile.name ?? "Unknown",
            bio: profile.bio ?? "No bio yet",
            area: profile.address ?? "Not specified",
            contactMethods:
              contactMethods.length > 0
                ? contactMethods.join(", ")
                : "None listed",
            memberSince: new Date(profile.createdAt).toLocaleDateString(locale),
            averageStars: ratings.averageStars,
            totalRatings: ratings.totalRatings,
            asLender: ratings.asLender,
            asBorrower: ratings.asBorrower,
            markdownLink: profileLink,
          };
        } catch (e) {
          console.error("getUserProfile failed:", e);
          return { error: "Could not fetch profile right now." };
        }
      },
    }),

    getMyProfile: tool({
      description:
        "Get the current user's own profile: name, bio, contacts, area. Use when the user asks about their own profile or settings.",
      inputSchema: noParams,
      execute: async () => {
        try {
          const profile = await convex.query(api.users.getMyProfile);
          if (!profile) {
            return {
              error: "Could not load your profile. Are you signed in?",
            };
          }
          const contacts = profile.contacts;
          const contactList = contacts
            ? Object.entries(contacts)
                .filter(([, v]) => v)
                .map(([k, v]) => `${k}: ${v}`)
            : [];
          return {
            name: profile.name ?? "Not set",
            bio: profile.bio ?? "No bio yet",
            area: profile.address ?? "Not specified",
            contacts:
              contactList.length > 0 ? contactList.join(", ") : "None listed",
            hasProfile: profile.hasProfile,
            summary: `Your profile: **${profile.name ?? "No name"}** — ${profile.bio ?? "no bio"} — ${profile.address ?? "no area set"}`,
          };
        } catch (e) {
          console.error("getMyProfile failed:", e);
          return { error: "Could not fetch your profile right now." };
        }
      },
    }),

    getNotifications: tool({
      description:
        "Get the user's recent notifications. Use when the user asks for updates or what's new. IMPORTANT: Copy the 'summary' field into your response — it contains clickable links.",
      inputSchema: noParams,
      execute: async () => {
        try {
          const notifs = await convex.query(api.notifications.get);
          const results = notifs.slice(0, 10).map((n) => ({
            notificationId: n._id,
            type: n.type.replace(/_/g, " "),
            isRead: n.isRead,
            itemId: n.itemId,
            itemName: n.item?.name ?? null,
            markdownLink: n.item ? itemLink(n.item.name, n.itemId) : null,
            createdAt: new Date(n.createdAt).toLocaleDateString(locale),
          }));
          if (results.length === 0)
            return { items: [], summary: "No notifications yet." };
          const lines = results.map((r) => {
            const link = r.markdownLink ?? r.itemName ?? "unknown";
            const readMark = r.isRead ? "" : " (new)";
            return `- ${r.type} — ${link}${readMark} (${r.createdAt})`;
          });
          return {
            items: results,
            summary: `${results.length} notification(s):\n${lines.join("\n")}`,
          };
        } catch (e) {
          console.error("getNotifications failed:", e);
          return { error: "Could not fetch notifications right now." };
        }
      },
    }),

    getMyPendingRatings: tool({
      description:
        "Get transactions the user hasn't rated yet. Use when the user asks about pending ratings, or proactively after a return is confirmed.",
      inputSchema: noParams,
      execute: async () => {
        try {
          const pending = await convex.query(api.ratings.getMyPendingRatings);
          if (pending.length === 0)
            return {
              items: [],
              summary: "No pending ratings — you're all caught up!",
            };
          const results = pending.map((r) => ({
            claimId: r.claimId,
            itemId: r.itemId,
            itemName: r.itemName,
            targetRole: r.targetRole,
            targetUserName: r.targetUserName,
            startDate: new Date(r.startDate).toLocaleDateString(locale),
            endDate: new Date(r.endDate).toLocaleDateString(locale),
            isGiveaway: r.isGiveaway,
            markdownLink: itemLink(r.itemName, r.itemId),
          }));
          const lines = results.map(
            (r) =>
              `- ${r.markdownLink} — rate ${r.targetUserName ?? "neighbor"} as ${r.targetRole}`,
          );
          return {
            items: results,
            summary: `${results.length} pending rating(s):\n${lines.join("\n")}`,
          };
        } catch (e) {
          console.error("getMyPendingRatings failed:", e);
          return { error: "Could not fetch pending ratings right now." };
        }
      },
    }),

    browseWishlist: tool({
      description:
        "List wishlist items with vote counts. Use when the user asks what people are wishing for, or before voting on a wish. IMPORTANT: Copy the 'summary' field into your response.",
      inputSchema: noParams,
      execute: async () => {
        try {
          const wishes = await convex.query(api.wishlist.list);
          const results = wishes.slice(0, 20).map((w) => ({
            wishId: w._id,
            text: w.text,
            votes: w.votes?.length ?? 0,
            matchCount: w.matchCount ?? 0,
            isOwner: w.isOwner ?? false,
            isLiked: w.isLiked ?? false,
            createdAt: new Date(w.createdAt).toLocaleDateString(locale),
          }));
          if (results.length === 0)
            return { items: [], summary: "The wishlist is empty." };
          const lines = results.map((r) => {
            const yours = r.isOwner ? " (yours)" : "";
            const voted = r.isLiked ? " ✓ voted" : "";
            return `- **${r.text}**${yours} — ${r.votes} vote(s), ${r.matchCount} match(es)${voted}`;
          });
          return {
            items: results,
            summary: `Wishlist (${results.length} wish(es)):\n${lines.join("\n")}`,
          };
        } catch (e) {
          console.error("browseWishlist failed:", e);
          return { error: "Could not fetch wishlist right now." };
        }
      },
    }),

    navigateTo: tool({
      description:
        "Generate a link to a page in the app. Use when the user wants to go somewhere. For another user's profile, use 'user-profile' with their userId.",
      inputSchema: jsonSchema<{
        page: string;
        itemId?: string;
        userId?: string;
      }>({
        type: "object",
        properties: {
          page: {
            type: "string",
            enum: [
              "home",
              "my-items",
              "profile",
              "wishlist",
              "notifications",
              "item-detail",
              "user-profile",
            ],
            description: "The page to navigate to",
          },
          itemId: stringParam("Required for item-detail page"),
          userId: stringParam("Required for user-profile page"),
        },
        required: ["page"],
      }),
      execute: async ({ page, itemId, userId }) => {
        const paths: Record<string, string> = {
          home: `/${locale}`,
          "my-items": `/${locale}/my-items`,
          profile: `/${locale}/profile`,
          wishlist: `/${locale}/wishlist`,
          notifications: `/${locale}/notifications`,
          "item-detail": `/${locale}/item/${itemId ?? ""}`,
          "user-profile": `/${locale}/user/${userId ?? ""}`,
        };
        return { url: paths[page] ?? `/${locale}` };
      },
    }),

    // Mutation tools
    ...buildMutationTools(convex, locale, attachedImageRefs),
  };
}
