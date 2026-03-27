import { anthropic } from "@ai-sdk/anthropic";
import { ConvexHttpClient } from "convex/browser";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { api } from "@/convex/_generated/api";
import { buildSystemPrompt } from "@/lib/sharry-prompt";
import { buildTools } from "@/lib/sharry-tools";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;
const UNAUTHED_MESSAGE_LIMIT = 5;

const IMAGE_REFS_PREFIX = "__IMAGE_REFS__";

function extractAndStripImageRefs(messages: any[]): {
	cleaned: any[];
	imageRefs: Array<{ publicId: string; secureUrl: string }>;
} {
	// Collect refs per-message so we can pick only the latest
	const refsByIndex: Array<Array<{ publicId: string; secureUrl: string }>> = [];
	const cleaned = messages.map((msg: any, msgIdx: number) => {
		if (msg.role !== "user" || !Array.isArray(msg.parts)) return msg;
		const msgRefs: Array<{ publicId: string; secureUrl: string }> = [];
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
						msgRefs.push(...refs);
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
		if (msgRefs.length > 0) refsByIndex[msgIdx] = msgRefs;
		return { ...msg, parts: mappedParts };
	});
	// Only use refs from the very last user message — if it has no images, refs is empty.
	// The LLM can still SEE older images via vision, but tools won't act on stale refs.
	const lastUserIdx = messages.findLastIndex((m: any) => m.role === "user");
	const imageRefs = refsByIndex[lastUserIdx] ?? [];
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

	const convex = new ConvexHttpClient(convexUrl);
	if (token) convex.setAuth(token);

	const userContext = isAuthed
		? await convex.query(api.chat.getUserContext)
		: null;

	const systemPrompt = buildSystemPrompt({ userContext, locale });
	const tools = buildTools(convex, locale, attachedImageRefs);

	try {
		const modelMessages = await convertToModelMessages(cleanedMessages);
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
