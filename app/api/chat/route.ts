import { anthropic } from "@ai-sdk/anthropic";
import { ConvexHttpClient } from "convex/browser";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { api } from "@/convex/_generated/api";
import { buildSystemPrompt } from "@/lib/sharry-prompt";
import { buildTools } from "@/lib/sharry-tools";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;
const UNAUTHED_MESSAGE_LIMIT = 5;

const IMAGE_REFS_PREFIX = "__IMAGE_REFS__";

type ImageRefWithContext = {
	publicId: string;
	secureUrl: string;
	context: string;
};

function extractAndStripImageRefs(messages: any[]): {
	cleaned: any[];
	imageRefs: ImageRefWithContext[];
} {
	const allRefs: ImageRefWithContext[] = [];
	const cleaned = messages.map((msg: any) => {
		if (msg.role !== "user" || !Array.isArray(msg.parts)) return msg;
		// Get the user's text from this message (before stripping sentinel)
		const msgText = msg.parts
			.filter((p: any) => p.type === "text" && p.text)
			.map((p: any) => {
				const idx = p.text.indexOf(IMAGE_REFS_PREFIX);
				return idx >= 0 ? p.text.slice(0, idx).trim() : p.text;
			})
			.join(" ")
			.trim()
			.slice(0, 80);
		const mappedParts = msg.parts
			.map((part: any) => {
				if (
					part.type === "text" &&
					typeof part.text === "string" &&
					part.text.includes(IMAGE_REFS_PREFIX)
				) {
					const idx = part.text.indexOf(IMAGE_REFS_PREFIX);
					const jsonStr = part.text.slice(idx + IMAGE_REFS_PREFIX.length);
					try {
						const refs = JSON.parse(jsonStr);
						for (const ref of refs) {
							allRefs.push({
								...ref,
								context: msgText || "attached image",
							});
						}
					} catch {
						/* ignore malformed */
					}
					const textBefore = part.text.slice(0, idx).trim();
					if (!textBefore) return null;
					return { ...part, text: textBefore };
				}
				return part;
			})
			.filter(Boolean);
		return { ...msg, parts: mappedParts };
	});
	// Deduplicate by publicId, keep chronological order
	const seen = new Set<string>();
	const imageRefs = allRefs.filter((ref) => {
		if (seen.has(ref.publicId)) return false;
		seen.add(ref.publicId);
		return true;
	});
	return { cleaned, imageRefs };
}

export async function POST(request: Request) {
	const token = request.headers.get("Authorization")?.replace("Bearer ", "");
	const { messages, locale } = await request.json();

	if (!Array.isArray(messages) || messages.length === 0) {
		return Response.json({ error: "Invalid request" }, { status: 400 });
	}

	const isAuthed = !!token;

	if (!isAuthed && messages.length > UNAUTHED_MESSAGE_LIMIT) {
		return Response.json(
			{ error: "Please log in to keep chatting with Sharry." },
			{ status: 401 },
		);
	}

	const { cleaned: cleanedMessages, imageRefs: attachedImageRefs } =
		extractAndStripImageRefs(messages);

	// Drop image file parts from older messages so the LLM doesn't re-see stale images.
	// Keep images only in the last 5 user messages. Refs are still available for tools.
	const RECENT_IMAGE_TURNS = 5;
	const userMsgIndices = cleanedMessages
		.map((m: any, i: number) => (m.role === "user" ? i : -1))
		.filter((i: number) => i >= 0);
	const recentCutoff =
		userMsgIndices[Math.max(0, userMsgIndices.length - RECENT_IMAGE_TURNS)] ??
		0;
	const visionMessages = cleanedMessages.map((msg: any, i: number) => {
		if (i >= recentCutoff || msg.role !== "user" || !Array.isArray(msg.parts))
			return msg;
		const filtered = msg.parts.filter(
			(p: any) => p.type !== "file" || !p.mediaType?.startsWith("image/"),
		);
		return { ...msg, parts: filtered };
	});

	const convex = new ConvexHttpClient(convexUrl);
	if (token) convex.setAuth(token);

	const userContext = isAuthed
		? await convex.query(api.chat.getUserContext)
		: null;

	let systemPrompt = buildSystemPrompt({ userContext, locale });

	// Tell the LLM which images are available for tool use, with context
	if (attachedImageRefs.length > 0) {
		const imageList = attachedImageRefs
			.map((ref, i) => `[${i + 1}] "${ref.context}"`)
			.join("\n");
		systemPrompt += `\n\n## Available images for tools\nThe user has shared ${attachedImageRefs.length} image(s). Each is numbered with the user's message that accompanied it:\n${imageList}\n\nWhen using tools that accept imageIndices, specify ONLY the image(s) relevant to the action. Match by the context description above — e.g. if creating a tent listing, use the image from the "tent" message, not the "monitor" message.`;
	}

	const tools = buildTools(convex, locale, attachedImageRefs);

	// Nudge fresh chat after 15+ conversation turns (user+assistant pairs)
	const FRESH_CHAT_THRESHOLD = 15;
	const turnCount = Math.floor(
		messages.filter((m: any) => m.role === "user" || m.role === "assistant")
			.length / 2,
	);
	if (turnCount >= FRESH_CHAT_THRESHOLD) {
		systemPrompt += "\n\n[FRESH_CHAT_HINT]";
	}

	try {
		const modelMessages = await convertToModelMessages(visionMessages);
		const result = streamText({
			model: anthropic("claude-haiku-4-5-20251001"),
			system: systemPrompt,
			messages: modelMessages,
			tools,
			stopWhen: stepCountIs(4),
			maxOutputTokens: 800,
			temperature: 0.5,
		});

		return result.toUIMessageStreamResponse();
	} catch {
		return Response.json(
			{ error: "Sharry is taking a break — try again in a moment." },
			{ status: 500 },
		);
	}
}
