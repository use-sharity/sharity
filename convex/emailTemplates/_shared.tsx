import {
	Body,
	Container,
	Head,
	Hr,
	Html,
	Img,
	Link,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import * as React from "react";

// ─── Theme ────────────────────────────────────────────────────────────────────

export const COLORS = {
	brand: "#18181b",
	heading: "#09090b",
	body: "#3f3f46",
	background: "#f4f4f5",
	content: "#ffffff",
	card: "#f4f4f5",
	button: "#18181b",
	buttonText: "#ffffff",
	danger: "#dc2626",
	dangerText: "#ffffff",
	muted: "#71717a",
	border: "#e4e4e7",
};

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface ContactInfo {
	telegram?: string;
	whatsapp?: string;
	facebook?: string;
	phone?: string;
}

export interface DigestNotification {
	type: string;
	itemName: string;
	createdAt: number;
	itemId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function appUrl(path: string): string {
	const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://sharity-dalat.com";
	return `${base}${path}`;
}

export function pad(n: number): string {
	return String(n).padStart(2, "0");
}

export function formatDate(ts: number): string {
	const d = new Date(ts);
	return d.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
	});
}

export function formatWindow(startTs: number, endTs: number): string {
	const s = new Date(startTs);
	const e = new Date(endTs);
	return `${formatDate(startTs)}, ${pad(s.getHours())}:${pad(s.getMinutes())}–${pad(e.getHours())}:${pad(e.getMinutes())}`;
}

export function contactLines(contacts: ContactInfo): string {
	const lines: string[] = [];
	if (contacts.telegram) lines.push(`Telegram: @${contacts.telegram}`);
	if (contacts.whatsapp) lines.push(`WhatsApp: ${contacts.whatsapp}`);
	if (contacts.facebook) lines.push(`Facebook: ${contacts.facebook}`);
	if (contacts.phone) lines.push(`Phone: ${contacts.phone}`);
	return lines.length > 0 ? lines.join("\n") : "No contact info provided.";
}

// ─── Shared layout components ─────────────────────────────────────────────────

export function EmailHeader() {
	return (
		<Section
			style={{
				backgroundColor: COLORS.brand,
				padding: "16px 24px",
				borderRadius: "8px 8px 0 0",
			}}
		>
			<Text
				style={{
					color: "#ffffff",
					fontSize: "18px",
					fontWeight: "700",
					margin: "0",
					letterSpacing: "-0.3px",
				}}
			>
				Sharity
			</Text>
		</Section>
	);
}

export function EmailFooter() {
	return (
		<>
			<Hr style={{ borderColor: COLORS.border, margin: "24px 0 16px" }} />
			<Text
				style={{
					color: COLORS.muted,
					fontSize: "12px",
					textAlign: "center" as const,
					margin: "0",
				}}
			>
				<Link href={appUrl("/")} style={{ color: COLORS.muted }}>
					Sharity
				</Link>{" "}
				· The community sharing platform
			</Text>
		</>
	);
}

interface SharityEmailProps {
	preview: string;
	children: React.ReactNode;
}

export function SharityEmail({ preview, children }: SharityEmailProps) {
	return (
		<Html>
			<Head />
			<Preview>{preview}</Preview>
			<Body
				style={{
					backgroundColor: COLORS.background,
					fontFamily:
						'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
					margin: "0",
					padding: "24px 0",
				}}
			>
				<Container
					style={{
						maxWidth: "600px",
						margin: "0 auto",
						backgroundColor: COLORS.content,
						borderRadius: "8px",
						overflow: "hidden",
						boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
					}}
				>
					<EmailHeader />
					<Section style={{ padding: "24px" }}>{children}</Section>
					<Section style={{ padding: "0 24px 24px" }}>
						<EmailFooter />
					</Section>
				</Container>
			</Body>
		</Html>
	);
}

// ─── Callout box ──────────────────────────────────────────────────────────────

interface CalloutProps {
	children: React.ReactNode;
	danger?: boolean;
}

export function Callout({ children, danger = false }: CalloutProps) {
	return (
		<Section
			style={{
				backgroundColor: danger ? COLORS.danger : COLORS.card,
				borderRadius: "6px",
				padding: "12px 16px",
				margin: "16px 0",
			}}
		>
			<Text
				style={{
					color: danger ? COLORS.dangerText : COLORS.body,
					fontSize: "14px",
					margin: "0",
				}}
			>
				{children}
			</Text>
		</Section>
	);
}

// ─── Button ───────────────────────────────────────────────────────────────────

interface EmailButtonProps {
	href: string;
	children: React.ReactNode;
}

export function EmailButton({ href, children }: EmailButtonProps) {
	return (
		<Section style={{ textAlign: "center" as const, margin: "20px 0" }}>
			<Link
				href={href}
				style={{
					backgroundColor: COLORS.button,
					color: COLORS.buttonText,
					padding: "10px 24px",
					borderRadius: "6px",
					fontSize: "14px",
					fontWeight: "600",
					textDecoration: "none",
					display: "inline-block",
				}}
			>
				{children}
			</Link>
		</Section>
	);
}
