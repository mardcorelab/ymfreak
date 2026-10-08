import "server-only";
import { env } from "../env";
import { AnthropicModel, ScriptedTestModel, type ChatModel } from "./llm";

export const DEFAULT_MODEL = "claude-sonnet-5-5";

/** True only in automated test runs, never on Vercel. */
export function agentTestMode(): boolean {
  return process.env.AGENT_TEST_MODE === "1" && !process.env.VERCEL;
}

let cached: ChatModel | null | undefined;

/** The assistant's model, or null when no API key is configured (the widget then stays hidden). */
export function getAgentModel(): ChatModel | null {
  if (cached !== undefined) return cached;
  if (agentTestMode()) cached = new ScriptedTestModel();
  else if (env.ANTHROPIC_API_KEY?.trim()) cached = new AnthropicModel(env.ANTHROPIC_API_KEY.trim(), env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL);
  else cached = null;
  return cached;
}

export function agentAvailable(): boolean {
  return getAgentModel() !== null;
}
