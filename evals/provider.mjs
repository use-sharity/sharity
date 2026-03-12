// evals/provider.mjs
//
// Promptfoo custom provider for Sharry.
// Builds the system prompt from test vars, calls Claude Haiku 4.5.

import { tsImport } from "tsx/esm/api";

const sharryPrompt = await tsImport("../lib/sharry-prompt.ts", import.meta.url);
const { buildSystemPrompt } = sharryPrompt.default ?? sharryPrompt;

const { anthropic } = await import("@ai-sdk/anthropic");
const { generateText } = await import("ai");

/** @type {import('promptfoo').ApiProvider} */
export default {
	id: () => "sharry-haiku",

	callApi: async (prompt, context) => {
		const userContext = context?.vars?.userContext ?? null;
		const locale = context?.vars?.locale ?? "en";

		const systemPrompt = buildSystemPrompt({ userContext, locale });

		try {
			const result = await generateText({
				model: anthropic("claude-haiku-4-5-20251001"),
				system: systemPrompt,
				prompt,
				maxOutputTokens: 600,
				temperature: 0.5,
			});

			return { output: result.text };
		} catch (error) {
			return { error: error.message ?? String(error) };
		}
	},
};
