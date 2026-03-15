import { anthropic } from "@ai-sdk/anthropic";
import { ConvexHttpClient } from "convex/browser";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { buildSystemPrompt } from "@/lib/sharry-prompt";
import { buildTools } from "@/lib/sharry-tools";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;

export async function POST(request: Request) {
	const token = request.headers.get("Authorization")?.replace("Bearer ", "");
	const { messages, userContext, locale } = await request.json();

	if (!Array.isArray(messages) || messages.length === 0) {
		return Response.json({ error: "Invalid request" }, { status: 400 });
	}

	const convex = new ConvexHttpClient(convexUrl);
	if (token) convex.setAuth(token);

	const systemPrompt = buildSystemPrompt({ userContext, locale });
	const tools = buildTools(convex, locale);

	try {
		const modelMessages = await convertToModelMessages(messages);
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
