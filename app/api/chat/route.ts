import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, streamText } from "ai";
import { buildSystemPrompt } from "@/lib/sharry-prompt";

// --- Route handler ---

export async function POST(request: Request) {
	const { messages, userContext, locale } = await request.json();

	if (!Array.isArray(messages) || messages.length === 0) {
		return Response.json({ error: "Invalid request" }, { status: 400 });
	}

	const systemPrompt = buildSystemPrompt({ userContext, locale });

	// try/catch covers initial setup errors (missing API key, invalid config).
	// Streaming errors are handled client-side via useChat's error state.
	try {
		const modelMessages = await convertToModelMessages(messages);
		const result = streamText({
			model: anthropic("claude-haiku-4-5-20251001"),
			system: systemPrompt,
			messages: modelMessages,
			maxOutputTokens: 600,
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
