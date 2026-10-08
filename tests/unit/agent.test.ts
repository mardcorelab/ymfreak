import { test } from "node:test";
import assert from "node:assert/strict";
import { AnthropicModel, ModelError, recentWindow, ScriptedTestModel, toApiMessages, type Block } from "../../src/server/agent/llm";
import { STABLE_PROMPT, dynamicPrompt } from "../../src/server/agent/prompt";
import { toBookingRequest } from "../../src/server/agent/booking-input";

const text = (t: string): Block[] => [{ type: "text", text: t }];
const toolUse = (id: string, name: string): Block[] => [{ type: "tool_use", id, name, input: {} }];
const toolResult = (id: string): Block[] => [{ type: "tool_result", tool_use_id: id, content: "{}" }];

test("history merges same-role rows, skips cards and starts with the visitor", () => {
  const msgs = toApiMessages([
    { role: "assistant", content: text("orphan") },
    { role: "user", content: text("hola") },
    { role: "assistant", content: toolUse("t1", "get_services") },
    { role: "tool", content: toolResult("t1") },
    { role: "card", content: text("ignored") },
    { role: "assistant", content: text("precios") },
    { role: "assistant", content: text("reserva creada") },
    { role: "user", content: text("gracias") },
  ]);
  assert.deepEqual(
    msgs.map((m) => [m.role, m.content.length]),
    [
      ["user", 1],
      ["assistant", 1],
      ["user", 1],
      ["assistant", 2],
      ["user", 1],
    ],
  );
  assert.equal(msgs[2]!.content[0]!.type, "tool_result");
});

test("recent window cuts only at a visitor text message", () => {
  const rows = [
    { role: "user", content: text("1") },
    { role: "assistant", content: toolUse("a", "x") },
    { role: "tool", content: toolResult("a") },
    { role: "assistant", content: text("r1") },
    { role: "user", content: text("2") },
    { role: "assistant", content: text("r2") },
    { role: "user", content: text("3") },
  ];
  const w = recentWindow(rows, 2);
  assert.equal(w.length, 3);
  assert.deepEqual(w[0]!.content, text("2"));
  assert.equal(recentWindow(rows, 10).length, rows.length);
  // A window never starts on a tool result.
  assert.deepEqual(recentWindow(rows.slice(2), 10)[0]!.content, text("2"));
});

test("scripted test model calls tools on request and reports results", async () => {
  const m = new ScriptedTestModel();
  const sys = { stable: "", dynamic: "" };
  const r1 = await m.complete({ system: sys, tools: [], messages: [{ role: "user", content: text('TOOL get_services {"a":1}') }] });
  assert.equal(r1.content[0]!.type, "tool_use");
  const call = r1.content[0] as Extract<Block, { type: "tool_use" }>;
  assert.deepEqual(call.input, { a: 1 });
  const r2 = await m.complete({
    system: sys,
    tools: [],
    messages: [
      { role: "user", content: text("x") },
      { role: "assistant", content: r1.content },
      { role: "user", content: [{ type: "tool_result", tool_use_id: call.id, content: '{"ok":1}' }] },
    ],
  });
  assert.match((r2.content[0] as { text: string }).text, /^TEST-REPLY get_services ok/);
});

test("Claude client sends tools, cached system prompt and parses tool use", async () => {
  let sent: { url: string; headers: Record<string, string>; body: Record<string, unknown> } | null = null;
  const fetchFn = (async (url: string, init: RequestInit) => {
    sent = { url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) };
    return new Response(
      JSON.stringify({
        content: [
          { type: "text", text: "Déjame ver" },
          { type: "tool_use", id: "toolu_1", name: "get_services", input: {} },
        ],
        stop_reason: "tool_use",
        usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 3 },
      }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;
  const m = new AnthropicModel("sk-test", "claude-test", { fetch: fetchFn });
  const res = await m.complete({
    system: { stable: "S", dynamic: "D" },
    messages: [{ role: "user", content: text("hola") }],
    tools: [{ name: "get_services", description: "d", input_schema: { type: "object", properties: {} } }],
  });
  assert.equal(res.stopReason, "tool_use");
  assert.equal(res.content.length, 2);
  assert.equal(res.usage?.cacheRead, 3);
  assert.ok(sent);
  const s = sent as unknown as { url: string; headers: Record<string, string>; body: Record<string, unknown> };
  assert.equal(s.url, "https://api.anthropic.com/v1/messages");
  assert.equal(s.headers["x-api-key"], "sk-test");
  assert.equal(s.headers["anthropic-version"], "2023-06-01");
  assert.equal(s.body.model, "claude-test");
  const system = s.body.system as { text: string; cache_control?: unknown }[];
  assert.deepEqual(system[0]!.cache_control, { type: "ephemeral" });
  assert.equal(system[1]!.text, "D");
  assert.equal((s.body.tools as unknown[]).length, 1);
});

test("Claude client surfaces API errors", async () => {
  const fetchFn = (async () => new Response('{"type":"error"}', { status: 400 })) as unknown as typeof fetch;
  const m = new AnthropicModel("k", "m", { fetch: fetchFn });
  await assert.rejects(m.complete({ system: { stable: "", dynamic: "" }, messages: [], tools: [] }), ModelError);
});

test("the prompt carries no business facts (they come from tools)", () => {
  assert.doesNotMatch(STABLE_PROMPT, /\$\s?\d|\d+\s?%|USD \d/);
  assert.doesNotMatch(STABLE_PROMPT, /\b(150|70|270|25|50|80)\b/);
  const d = dynamicPrompt({ now: new Date("2026-10-08T15:00:00Z"), timeZone: "America/Santo_Domingo", bookingOpen: false, pageLocale: "es" });
  assert.match(d, /Thursday, October 8, 2026/);
  assert.match(d, /CLOSED/);
});

test("assistant booking input validates like the booking form", () => {
  const ok = toBookingRequest(
    { mode: "DELIVERY", services: ["mezcla-mastering"], songs: 2, name: "Ana Pérez", email: "ANA@example.com ", artist_name: "Ana", song_title: "Luna" },
    "es",
  );
  assert.ok(ok.success);
  if (ok.success && ok.data.mode === "DELIVERY") {
    assert.equal(ok.data.customer.email, "ana@example.com");
    assert.equal(ok.data.songs, 2);
    assert.equal("priceCents" in ok.data, false);
  }
  const missingSong = toBookingRequest({ mode: "DELIVERY", services: ["mastering"], songs: 1, name: "Ana Pérez", email: "ana@example.com", artist_name: "Ana" }, "es");
  assert.equal(missingSong.success, false);
  const badEmail = toBookingRequest({ mode: "SESSION", service: "asesoria-productores", hours: 1, starts_at: "2026-10-12T14:00:00.000Z", name: "Ana", email: "nope", artist_name: "Ana" }, "en");
  assert.equal(badEmail.success, false);
  const session = toBookingRequest(
    { mode: "SESSION", service: "asesoria-productores", hours: 1, starts_at: "2026-10-12T14:00:00.000Z", name: "Ana Pérez", email: "ana@example.com", artist_name: "Ana" },
    "en",
  );
  assert.ok(session.success);
});
