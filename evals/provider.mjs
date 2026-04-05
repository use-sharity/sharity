// evals/provider.mjs
//
// Promptfoo custom provider for Sharry.
// Builds system prompt + tools with MOCK execute handlers.
// Tools return static data so the LLM completes the full loop:
// pick tool → get mock result → generate final response.

import { tsImport } from "tsx/esm/api";
import { buildMockTools } from "./mock-tools.mjs";

const sharryPrompt = await tsImport("../lib/sharry-prompt.ts", import.meta.url);
const { buildSystemPrompt } = sharryPrompt.default ?? sharryPrompt;

const { anthropic } = await import("@ai-sdk/anthropic");
const { generateText } = await import("ai");

export default class SharryProvider {
  id() {
    return "sharry-haiku";
  }

  async callApi(prompt, context) {
    const userContext = context?.vars?.userContext ?? null;
    const locale = context?.vars?.locale ?? "en";
    const useTools = context?.vars?.useTools !== false;

    const systemPrompt = buildSystemPrompt({ userContext, locale });
    const tools = useTools ? buildMockTools(locale) : undefined;

    try {
      const result = await generateText({
        model: anthropic("claude-haiku-4-5-20251001"),
        system: systemPrompt,
        prompt,
        tools,
        maxSteps: 4,
        maxOutputTokens: 800,
        temperature: 0.5,
      });

      // Collect tool calls and results across all steps
      const toolCalls = [];
      const toolOutputs = [];
      for (const step of result.steps ?? []) {
        for (const tc of step.toolCalls ?? []) {
          toolCalls.push(tc.toolName);
        }
        for (const tr of step.toolResults ?? []) {
          toolOutputs.push(tr.output);
        }
      }

      // Build output: tool call tags + LLM text + tool result summaries
      // Embed tool names in the output so JS assertions can check via string matching
      const toolTag =
        toolCalls.length > 0 ? `[TOOLS_CALLED: ${toolCalls.join(", ")}]\n` : "";
      let output = toolTag + (result.text || "");
      for (const toolOut of toolOutputs) {
        if (toolOut?.summary) {
          output += "\n" + toolOut.summary;
        }
      }

      const metadata = {
        toolCalls,
        toolCallCount: toolCalls.length,
      };

      return { output, metadata };
    } catch (error) {
      return { error: error.message ?? String(error) };
    }
  }
}
