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
	},
	handler: async (ctx, args) => {
		const key = `welcome/${args.clerkId}`;
		const alreadySent = await ctx.runQuery(internal.emails.hasEmailBeenSent, {
			key,
		});
		if (alreadySent) return;

		await sendMail(
			ctx,
			args.email,
			"Welcome to Sharity!",
			React.createElement(WelcomeEmail, { name: args.name }),
		);
		await ctx.runMutation(internal.emails.logEmail, { key });
	},
});

// ─── 2. Lease Approved ────────────────────────────────────────────────────────

export const sendLeaseApproved = internalAction({
	args: {
		claimId: v.id("claims"),
		borrowerEmail: v.string(),
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

		const data: LeaseApprovedData = args.data;
		await sendMail(
			ctx,
			args.borrowerEmail,
			`Your request for "${data.itemName}" was approved`,
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

		const data1 = args.data1 as MeetupConfirmedData;
		const data2 = args.data2 as MeetupConfirmedData;
		const subject = `Meetup confirmed for "${data1.itemName}"`;

		await Promise.all([
			!sent1
				? sendMail(
						ctx,
						args.recipient1Email,
						subject,
						React.createElement(MeetupConfirmedEmail, data1),
					).then(() => ctx.runMutation(internal.emails.logEmail, { key: key1 }))
				: Promise.resolve(),
			!sent2
				? sendMail(
						ctx,
						args.recipient2Email,
						subject,
						React.createElement(MeetupConfirmedEmail, data2),
					).then(() => ctx.runMutation(internal.emails.logEmail, { key: key2 }))
				: Promise.resolve(),
		]);
	},
});

// ─── 4. Daily Digest ─────────────────────────────────────────────────────────

export const sendDailyDigests = internalAction({
	args: {},
	handler: async (ctx) => {
		const usersWithActivity: Array<{
			clerkId: string;
			email: string;
			data: DigestData;
		}> = await ctx.runQuery(internal.emails.buildDigestPayloads, {});

		for (const user of usersWithActivity) {
			const dateKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
			const key = `digest/${user.clerkId}/${dateKey}`;
			const alreadySent = await ctx.runQuery(internal.emails.hasEmailBeenSent, {
				key,
			});
			if (alreadySent) continue;

			await sendMail(
				ctx,
				user.email,
				`Your Sharity activity — ${dateKey}`,
				React.createElement(DailyDigestEmail, user.data),
			);
			await ctx.runMutation(internal.emails.logEmail, { key });
		}
	},
});

// ─── 5. Overdue / Missing Alert ───────────────────────────────────────────────

export const sendOverdueAlert = internalAction({
	args: {
		claimId: v.id("claims"),
		alertType: v.union(v.literal("missing"), v.literal("expired")),
		ownerEmail: v.string(),
		borrowerEmail: v.string(),
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

		const ownerData = args.ownerData as OverdueAlertData;
		const borrowerData = args.borrowerData as OverdueAlertData;
		const subject = `Action needed: "${ownerData.itemName}" is overdue`;

		await Promise.all([
			!sentOwner
				? sendMail(
						ctx,
						args.ownerEmail,
						subject,
						React.createElement(OverdueAlertEmail, ownerData),
					).then(() =>
						ctx.runMutation(internal.emails.logEmail, { key: keyOwner }),
					)
				: Promise.resolve(),
			!sentBorrower
				? sendMail(
						ctx,
						args.borrowerEmail,
						subject,
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

		const data: NewRequestData = args.data;
		await sendMail(
			ctx,
			args.ownerEmail,
			`New request for "${data.itemName}"`,
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

		const data: RequestRejectedData = args.data;
		await sendMail(
			ctx,
			args.borrowerEmail,
			`Your request for "${data.itemName}" was not approved`,
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

		const data: MeetupProposedData = args.data;
		const typeLabel = args.meetupType === "pickup" ? "Pickup" : "Return";
		await sendMail(
			ctx,
			args.recipientEmail,
			`${typeLabel} time proposed for "${data.itemName}"`,
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

		const data: ItemAvailableData = args.data;
		await sendMail(
			ctx,
			args.recipientEmail,
			`"${data.itemName}" is available again!`,
			React.createElement(ItemAvailableEmail, data),
		);
		await ctx.runMutation(internal.emails.logEmail, { key });
	},
});
