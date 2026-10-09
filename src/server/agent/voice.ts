import "server-only";
import { env } from "../env";
import { db } from "../db";
import { allowRate } from "../rate-limit";
import { agentTestMode } from "./model";
import { isConversationId } from "./chat";

/**
 * Voice notes for the assistant through ElevenLabs: speech-to-text for the
 * visitor's notes and text-to-speech in YM Freak's cloned voice for replies.
 * Switched on only when ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID are set
 * (in automated tests a stand-in returns fixed results). Replies are always
 * labelled as an AI-generated voice in the widget.
 */

const API = "https://api.elevenlabs.io/v1";
export const MAX_NOTE_BYTES = 10 * 1024 * 1024;
const MAX_SPEAK_CHARS = 1200;

export function voiceEnabled(): boolean {
  return agentTestMode() || Boolean(env.ELEVENLABS_API_KEY?.trim() && env.ELEVENLABS_VOICE_ID?.trim());
}

export type VoiceError = "NOT_CONFIGURED" | "RATE_LIMITED" | "INVALID" | "TOO_BIG" | "EMPTY" | "NOT_FOUND" | "VOICE_ERROR";

export async function transcribe(audio: Blob, locale: "es" | "en", ip: string): Promise<{ ok: true; text: string } | { ok: false; error: VoiceError }> {
  if (!voiceEnabled()) return { ok: false, error: "NOT_CONFIGURED" };
  if (audio.size === 0) return { ok: false, error: "EMPTY" };
  if (audio.size > MAX_NOTE_BYTES) return { ok: false, error: "TOO_BIG" };
  if (!(await allowRate(`voice-in:${ip}`, 15, 10 * 60_000))) return { ok: false, error: "RATE_LIMITED" };
  if (agentTestMode()) return { ok: true, text: "TEST-TRANSCRIPT nota de voz" };

  const form = new FormData();
  form.append("model_id", env.ELEVENLABS_STT_MODEL?.trim() || "scribe_v2");
  form.append("file", audio, "nota.webm");
  form.append("language_code", locale === "en" ? "en" : "es");
  form.append("tag_audio_events", "false");
  try {
    const res = await fetch(`${API}/speech-to-text`, {
      method: "POST",
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY!.trim() },
      body: form,
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      console.error("[voice] stt", res.status, (await res.text()).slice(0, 300));
      return { ok: false, error: "VOICE_ERROR" };
    }
    const data = (await res.json()) as { text?: string };
    const text = (data.text ?? "").trim();
    return text ? { ok: true, text: text.slice(0, 2000) } : { ok: false, error: "EMPTY" };
  } catch (e) {
    console.error("[voice] stt failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "VOICE_ERROR" };
  }
}

/**
 * Speaks one of the assistant's own replies. The text must match a reply
 * stored in that conversation, so the endpoint can't be used to make the
 * cloned voice say anything else.
 */
export async function speak(conversationId: unknown, text: unknown, ip: string): Promise<{ ok: true; audio: ArrayBuffer; type: string } | { ok: false; error: VoiceError }> {
  if (!voiceEnabled()) return { ok: false, error: "NOT_CONFIGURED" };
  if (!isConversationId(conversationId) || typeof text !== "string" || !text.trim()) return { ok: false, error: "INVALID" };
  const wanted = text.trim();
  const rows = await db.message.findMany({ where: { conversationId, role: "assistant" }, orderBy: { seq: "desc" }, take: 40, select: { content: true } });
  const said = rows.some((r) => Array.isArray(r.content) && (r.content as unknown as { type?: string; text?: string }[]).some((b) => b?.type === "text" && b.text?.trim() === wanted));
  if (!said) return { ok: false, error: "NOT_FOUND" };
  if (!(await allowRate(`voice-out:${ip}`, 30, 10 * 60_000))) return { ok: false, error: "RATE_LIMITED" };
  if (!(await allowRate("voice-out:all", 1500, 24 * 60 * 60_000))) return { ok: false, error: "RATE_LIMITED" };
  if (agentTestMode()) return { ok: true, audio: silentWav(), type: "audio/wav" };

  try {
    const res = await fetch(`${API}/text-to-speech/${encodeURIComponent(env.ELEVENLABS_VOICE_ID!.trim())}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": env.ELEVENLABS_API_KEY!.trim(), "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: wanted.slice(0, MAX_SPEAK_CHARS), model_id: env.ELEVENLABS_TTS_MODEL?.trim() || "eleven_multilingual_v2" }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      console.error("[voice] tts", res.status, (await res.text()).slice(0, 300));
      return { ok: false, error: "VOICE_ERROR" };
    }
    return { ok: true, audio: await res.arrayBuffer(), type: "audio/mpeg" };
  } catch (e) {
    console.error("[voice] tts failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "VOICE_ERROR" };
  }
}

/** 0.2 s of silence, for automated tests. */
function silentWav(): ArrayBuffer {
  const rate = 8000;
  const n = rate / 5;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + n, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  str(36, "data");
  v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return buf;
}
