"use node";

import { render } from "@react-email/render";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
	WelcomeEmail,
	LeaseApprovedEmail,
	MeetupConfirmedEmail,
	DailyDigestEmail,
	OverdueAlertEmail,
	NewRequestEmail,
	RequestRejectedEmail,
	MeetupProposedEmail,
	ItemAvailableEmail,
} from "./emailTemplates/index";
import type {
	LeaseApprovedData,
	MeetupConfirmedData,
	DigestData,
	OverdueAlertData,
	NewRequestData,
	RequestRejectedData,
	MeetupProposedData,
	ItemAvailableData,
} from "./emailTemplates/index";
import * as React from "react";
import { resend, FROM } from "./resendClient";
import type { ActionCtx } from "./_generated/server";
import { t } from "./emailTemplates/i18n";
import type { Locale } from "./emailTemplates/i18n";

// ─── Locale validator ─────────────────────────────────────────────────────────

const localeValidator = v.optional(
	v.union(v.literal("en"), v.literal("vi"), v.literal("ru")),
);

function resolveLocale(locale: string | undefined): Locale {
	return (locale as Locale | undefined) ?? "en";
}

// ─── Internal helper ──────────────────────────────────────────────────────────

async function sendMail(
	ctx: ActionCtx,
	to: string,
	subject: string,
	component: React.ReactElement,
): Promise<void> {
	const html = await render(component);
	const text = await render(component, { plainText: true });
	await resend.sendEmail(ctx, { from: FROM, to: [to], subject, html, text });
}

// ─── 1. Welcome ───────────────────────────────────────────────────────────────

export const sendWelcome = internalAction({
	args: {
		clerkId: v.string(),
		email: v.string(),
		name: v.string(),
		locale: localeValidator,
	},
	handler: async (ctx, args) => {
		const key = `welcome/${args.clerkId}`;
		const alreadySent = await ctx.runQuery(internal.emails.hasEmailBeenSent, {
			key,
		});
		if (alreadySent) return;

		const locale = resolveLocale(args.locale);
		await sendMail(
			ctx,
			args.email,
			t(locale, "welcome.subject"),
			React.createElement(WelcomeEmail, { name: args.name, locale }),
		);
		await ctx.runMutation(internal.emails.logEmail, { key });
	},
});

// ─── 2. Lease Approved ────────────────────────────────────────────────────────

export const sendLeaseApproved = internalAction({
	args: {
		claimId: v.id("claims"),
		borrowerEmail: v.string(),
		locale: localeValidator,
		data: v.object({
			borrowerName: v.string(),
			itemName: v.string(),
			startDate: v.number(),
			endDate: v.number(),
			claimId: v.string(),
			itemId: v.string(),
		}),
	},
	handler: async (ctx, args) => {
		const key = `lease-approved/${args.claimId}`;
		const alreadySent = await ctx.runQuery(internal.emails.hasEmailBeenSent, {
			key,
		});
		if (alreadySent) return;

		const locale = resolveLocale(args.locale);
		const data: LeaseApprovedData = { ...args.data, locale };
		await sendMail(
			ctx,
			args.borrowerEmail,
			t(locale, "leaseApproved.subject", { itemName: data.itemName }),
			React.createElement(LeaseApprovedEmail, data),
		);
		await ctx.runMutation(internal.emails.logEmail, { key });
	},
});

// ─── 3. Meetup Confirmed ─────────────────────────────────────────────────────

export const sendMeetupConfirmed = internalAction({
	args: {
		claimId: v.id("claims"),
		meetupType: v.union(v.literal("pickup"), v.literal("return")),
		recipient1Email: v.string(),
		recipient2Email: v.string(),
		locale1: localeValidator,
		locale2: localeValidator,
		data1: v.object({
			recipientName: v.string(),
			counterpartyName: v.string(),
			counterpartyContacts: v.object({
				telegram: v.optional(v.string()),
				whatsapp: v.optional(v.string()),
				facebook: v.optional(v.string()),
				phone: v.optional(v.string()),
			}),
			itemName: v.string(),
			windowStartAt: v.number(),
			windowEndAt: v.number(),
			itemId: v.string(),
			meetupType: v.union(v.literal("pickup"), v.literal("return")),
		}),
		data2: v.object({
			recipientName: v.string(),
			counterpartyName: v.string(),
			counterpartyContacts: v.object({
				telegram: v.optional(v.string()),
				whatsapp: v.optional(v.string()),
				facebook: v.optional(v.string()),
				phone: v.optional(v.string()),
			}),
			itemName: v.string(),
			windowStartAt: v.number(),
			windowEndAt: v.number(),
			itemId: v.string(),
			meetupType: v.union(v.literal("pickup"), v.literal("return")),
		}),
	},
	handler: async (ctx, args) => {
		const key1 = `meetup-${args.meetupType}-borrower/${args.claimId}`;
		const key2 = `meetup-${args.meetupType}-owner/${args.claimId}`;

		const [sent1, sent2] = await Promise.all([
			ctx.runQuery(internal.emails.hasEmailBeenSent, { key: key1 }),
			ctx.runQuery(internal.emails.hasEmailBeenSent, { key: key2 }),
		]);

		const locale1 = resolveLocale(args.locale1);
		const locale2 = resolveLocale(args.locale2);
		const data1: MeetupConfirmedData = { ...args.data1, locale: locale1 };
		const data2: MeetupConfirmedData = { ...args.data2, locale: locale2 };

		await Promise.all([
			!sent1
				? sendMail(
						ctx,
						args.recipient1Email,
						t(locale1, "meetupConfirmed.subject", { itemName: data1.itemName }),
						React.createElement(MeetupConfirmedEmail, data1),
					).then(() =>
						ctx.runMutation(internal.emails.logEmail, { key: key1 }),
					)
				: Promise.resolve(),
			!sent2
				? sendMail(
						ctx,
						args.recipient2Email,
						t(locale2, "meetupConfirmed.subject", { itemName: data2.itemName }),
						React.createElement(MeetupConfirmedEmail, data2),
					).then(() =>
						ctx.runMutation(internal.emails.logEmail, { key: key2 }),
					)
				: Promise.resolve(),
		]);
	},
});

// ─── 4. Daily / Weekly Digest ─────────────────────────────────────────────────

async function sendDigests(
	ctx: ActionCtx,
	mode: "daily" | "weekly",
): Promise<void> {
	const usersWithActivity: Array<{
		clerkId: string;
		email: string;
		locale: Locale;
		data: Omit<DigestData, "locale">;
	}> = await ctx.runQuery(internal.emails.buildDigestPayloads, { mode });

	for (const user of usersWithActivity) {
		const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
		const key = `digest-${mode}/${user.clerkId}/${dateKey}`;
		const alreadySent = await ctx.runQuery(internal.emails.hasEmailBeenSent, {
			key,
		});
		if (alreadySent) continue;

		const locale = user.locale;
		const digestData: DigestData = { ...user.data, locale };
		await sendMail(
			ctx,
			user.email,
			t(locale, "digest.subject", { date: dateKey }),
			React.createElement(DailyDigestEmail, digestData),
		);
		await ctx.runMutation(internal.emails.logEmail, { key });
	}
}

export const sendDailyDigests = internalAction({
	args: {},
	handler: async (ctx) => sendDigests(ctx, "daily"),
});

export const sendWeeklyDigests = internalAction({
	args: {},
	handler: async (ctx) => sendDigests(ctx, "weekly"),
});

// ─── 5. Overdue / Missing Alert ───────────────────────────────────────────────

export const sendOverdueAlert = internalAction({
	args: {
		claimId: v.id("claims"),
		alertType: v.union(v.literal("missing"), v.literal("expired")),
		ownerEmail: v.string(),
		borrowerEmail: v.string(),
		ownerLocale: localeValidator,
		borrowerLocale: localeValidator,
		ownerData: v.object({
			recipientName: v.string(),
			itemName: v.string(),
			originalEndDate: v.number(),
			counterpartyName: v.string(),
			counterpartyContacts: v.object({
				telegram: v.optional(v.string()),
				whatsapp: v.optional(v.string()),
				facebook: v.optional(v.string()),
				phone: v.optional(v.string()),
			}),
			itemId: v.string(),
			role: v.union(v.literal("owner"), v.literal("borrower")),
		}),
		borrowerData: v.object({
			recipientName: v.string(),
			itemName: v.string(),
			originalEndDate: v.number(),
			counterpartyName: v.string(),
			counterpartyContacts: v.object({
				telegram: v.optional(v.string()),
				whatsapp: v.optional(v.string()),
				facebook: v.optional(v.string()),
				phone: v.optional(v.string()),
			}),
			itemId: v.string(),
			role: v.union(v.literal("owner"), v.literal("borrower")),
		}),
	},
	handler: async (ctx, args) => {
		const keyOwner = `overdue-${args.alertType}-owner/${args.claimId}`;
		const keyBorrower = `overdue-${args.alertType}-borrower/${args.claimId}`;

		const [sentOwner, sentBorrower] = await Promise.all([
			ctx.runQuery(internal.emails.hasEmailBeenSent, { key: keyOwner }),
			ctx.runQuery(internal.emails.hasEmailBeenSent, { key: keyBorrower }),
		]);

		const ownerLocale = resolveLocale(args.ownerLocale);
		const borrowerLocale = resolveLocale(args.borrowerLocale);
		const ownerData: OverdueAlertData = { ...args.ownerData, locale: ownerLocale };
		const borrowerData: OverdueAlertData = {
			...args.borrowerData,
			locale: borrowerLocale,
		};

		await Promise.all([
			!sentOwner
				? sendMail(
						ctx,
						args.ownerEmail,
						t(ownerLocale, "overdueAlert.subject", { itemName: ownerData.itemName }),
						React.createElement(OverdueAlertEmail, ownerData),
					).then(() =>
						ctx.runMutation(internal.emails.logEmail, { key: keyOwner }),
					)
				: Promise.resolve(),
			!sentBorrower
				? sendMail(
						ctx,
						args.borrowerEmail,
						t(borrowerLocale, "overdueAlert.subject", {
							itemName: borrowerData.itemName,
						}),
						React.createElement(OverdueAlertEmail, borrowerData),
					).then(() =>
						ctx.runMutation(internal.emails.logEmail, { key: keyBorrower }),
					)
				: Promise.resolve(),
		]);
	},
});

// ─── 6. New Request ──────────────────────────────────────────────────────────

export const sendNewRequest = internalAction({
	args: {
		claimId: v.id("claims"),
		ownerEmail: v.string(),
		locale: localeValidator,
		data: v.object({
			ownerName: v.string(),
			borrowerName: v.string(),
			itemName: v.string(),
			startDate: v.number(),
			endDate: v.number(),
			itemId: v.string(),
		}),
	},
	handler: async (ctx, args) => {
		const key = `new-request/${args.claimId}`;
		const alreadySent = await ctx.runQuery(internal.emails.hasEmailBeenSent, {
			key,
		});
		if (alreadySent) return;

		const locale = resolveLocale(args.locale);
		const data: NewRequestData = { ...args.data, locale };
		await sendMail(
			ctx,
			args.ownerEmail,
			t(locale, "newRequest.subject", { itemName: data.itemName }),
			React.createElement(NewRequestEmail, data),
		);
		await ctx.runMutation(internal.emails.logEmail, { key });
	},
});

// ─── 7. Request Rejected ─────────────────────────────────────────────────────

export const sendRequestRejected = internalAction({
	args: {
		claimId: v.id("claims"),
		borrowerEmail: v.string(),
		locale: localeValidator,
		data: v.object({
			borrowerName: v.string(),
			itemName: v.string(),
			startDate: v.number(),
			endDate: v.number(),
		}),
	},
	handler: async (ctx, args) => {
		const key = `request-rejected/${args.claimId}`;
		const alreadySent = await ctx.runQuery(internal.emails.hasEmailBeenSent, {
			key,
		});
		if (alreadySent) return;

		const locale = resolveLocale(args.locale);
		const data: RequestRejectedData = { ...args.data, locale };
		await sendMail(
			ctx,
			args.borrowerEmail,
			t(locale, "requestRejected.subject", { itemName: data.itemName }),
			React.createElement(RequestRejectedEmail, data),
		);
		await ctx.runMutation(internal.emails.logEmail, { key });
	},
});

// ─── 8. Meetup Proposed ──────────────────────────────────────────────────────

export const sendMeetupProposed = internalAction({
	args: {
		claimId: v.id("claims"),
		meetupType: v.union(v.literal("pickup"), v.literal("return")),
		recipientEmail: v.string(),
		locale: localeValidator,
		data: v.object({
			recipientName: v.string(),
			proposerName: v.string(),
			itemName: v.string(),
			windowStartAt: v.number(),
			windowEndAt: v.number(),
			itemId: v.string(),
			meetupType: v.union(v.literal("pickup"), v.literal("return")),
		}),
	},
	handler: async (ctx, args) => {
		const key = `meetup-${args.meetupType}-proposed/${args.claimId}/${args.data.windowStartAt}`;
		const alreadySent = await ctx.runQuery(internal.emails.hasEmailBeenSent, {
			key,
		});
		if (alreadySent) return;

		const locale = resolveLocale(args.locale);
		const typeKey = args.meetupType === "pickup" ? "pickup" : "return";
		const data: MeetupProposedData = { ...args.data, locale };
		await sendMail(
			ctx,
			args.recipientEmail,
			t(locale, `meetupProposed.subject.${typeKey}`, { itemName: data.itemName }),
			React.createElement(MeetupProposedEmail, data),
		);
		await ctx.runMutation(internal.emails.logEmail, { key });
	},
});

// ─── 9. Item Available ───────────────────────────────────────────────────────

export const sendItemAvailable = internalAction({
	args: {
		itemId: v.id("items"),
		recipientClerkId: v.string(),
		recipientEmail: v.string(),
		locale: localeValidator,
		data: v.object({
			recipientName: v.string(),
			itemName: v.string(),
			itemId: v.string(),
		}),
	},
	handler: async (ctx, args) => {
		const key = `item-available/${args.itemId}/${args.recipientClerkId}`;
		const alreadySent = await ctx.runQuery(internal.emails.hasEmailBeenSent, {
			key,
		});
		if (alreadySent) return;

		const locale = resolveLocale(args.locale);
		const data: ItemAvailableData = { ...args.data, locale };
		await sendMail(
			ctx,
			args.recipientEmail,
			t(locale, "itemAvailable.subject", { itemName: data.itemName }),
			React.createElement(ItemAvailableEmail, data),
		);
		await ctx.runMutation(internal.emails.logEmail, { key });
	},
});
