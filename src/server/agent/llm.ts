/**
 * Minimal client for the Claude Messages API (tool use), plus a scripted
 * stand-in used only by automated tests. No SDK: one fetch call per turn.
 * Docs: https://docs.claude.com/en/docs/agents-and-tools/tool-use/overview
 */

export type TextBlock = { type: "text"; text: string };
export type ToolUseBlock = { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
export type ToolResultBlock = { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
export type Block = TextBlock | ToolUseBlock | ToolResultBlock;

export interface ApiMessage {
  role: "user" | "assistant";
  content: Block[];
}

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ModelRequest {
  /** Stable instructions (cached by the API) followed by per-request context. */
  system: { stable: string; dynamic: string };
  messages: ApiMessage[];
  tools: ToolDef[];
}

export interface ModelResponse {
  content: Block[];
  stopReason: string;
  usage?: { input: number; output: number; cacheRead: number };
}

export interface ChatModel {
  readonly name: string;
  complete(req: ModelRequest): Promise<ModelResponse>;
}

export class ModelError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

type Fetch = typeof fetch;

export class AnthropicModel implements ChatModel {
  constructor(
    private readonly apiKey: string,
    readonly name: string,
    private readonly opts: { maxTokens?: number; fetch?: Fetch; timeoutMs?: number } = {},
  ) {}

  async complete(req: ModelRequest): Promise<ModelResponse> {
    const body = {
      model: this.name,
      max_tokens: this.opts.maxTokens ?? 1024,
      system: [
        { type: "text", text: req.system.stable, cache_control: { type: "ephemeral" } },
        { type: "text", text: req.system.dynamic },
      ],
      tools: req.tools,
      messages: req.messages,
    };
    const http = this.opts.fetch ?? fetch;

    for (let attempt = 1; ; attempt++) {
      const res = await http("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(this.opts.timeoutMs ?? 45_000),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          content: Block[];
          stop_reason: string;
          usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number };
        };
        return {
          content: json.content.filter((b) => b.type === "text" || b.type === "tool_use"),
          stopReason: json.stop_reason,
          usage: {
            input: json.usage?.input_tokens ?? 0,
            output: json.usage?.output_tokens ?? 0,
            cacheRead: json.usage?.cache_read_input_tokens ?? 0,
          },
        };
      }
      // Overloaded / rate limited / transient: one retry after a short pause.
      if ((res.status === 429 || res.status === 529 || res.status >= 500) && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      const detail = await res.text().catch(() => "");
      throw new ModelError(`Claude API ${res.status}: ${detail.slice(0, 300)}`, res.status);
    }
  }
}

/**
 * Deterministic model for end-to-end tests (no network, no key). A visitor
 * message of the form `TOOL <name> <json>` makes it call that tool; after a
 * tool result it answers `TEST-REPLY <name> ok|error`; anything else is echoed.
 */
export class ScriptedTestModel implements ChatModel {
  readonly name = "scripted-test";

  async complete(req: ModelRequest): Promise<ModelResponse> {
    const last = req.messages.at(-1);
    const results = last?.content.filter((b): b is ToolResultBlock => b.type === "tool_result") ?? [];
    if (results.length > 0) {
      const prev = req.messages.at(-2)?.content.find((b): b is ToolUseBlock => b.type === "tool_use");
      const r = results[0]!;
      return { content: [{ type: "text", text: `TEST-REPLY ${prev?.name ?? "?"} ${r.is_error ? "error" : "ok"}: ${r.content.slice(0, 400)}` }], stopReason: "end_turn" };
    }
    const text = last?.content.find((b): b is TextBlock => b.type === "text")?.text ?? "";
    const m = /^TOOL (\w+) (\{[\s\S]*\})$/.exec(text.trim());
    if (m) {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(m[2]!) as Record<string, unknown>;
      } catch {
        /* empty input */
      }
      return { content: [{ type: "tool_use", id: `toolu_test_${Date.now()}`, name: m[1]!, input }], stopReason: "tool_use" };
    }
    return { content: [{ type: "text", text: `TEST-REPLY echo: ${text}` }], stopReason: "end_turn" };
  }
}

/** Builds the API message list from stored rows: merges same-role neighbours and starts at a visitor turn. */
export function toApiMessages(rows: { role: string; content: Block[] }[]): ApiMessage[] {
  const out: ApiMessage[] = [];
  for (const row of rows) {
    if (row.role === "card") continue;
    const role = row.role === "assistant" ? "assistant" : "user";
    const prev = out.at(-1);
    if (prev && prev.role === role) prev.content = [...prev.content, ...row.content];
    else out.push({ role, content: [...row.content] });
  }
  while (out.length && out[0]!.role !== "user") out.shift();
  return out;
}

/**
 * Keeps the most recent part of a conversation that fits the budget, cutting
 * only at a visitor's text message so tool calls are never split from their results.
 */
export function recentWindow<T extends { role: string; content: Block[] }>(rows: T[], maxUserTurns: number): T[] {
  let turns = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i]!;
    if (r.role === "user" && r.content.some((b) => b.type === "text")) {
      turns++;
      if (turns === maxUserTurns) return rows.slice(i);
    }
  }
  const first = rows.findIndex((r) => r.role === "user" && r.content.some((b) => b.type === "text"));
  return first === -1 ? [] : rows.slice(first);
}
