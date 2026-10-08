/// <reference lib="webworker" />
import { measureLoudness } from "@/lib/audio/loudness";

// Runs the measurement off the main thread so the page stays responsive.
const ctx = self as unknown as { onmessage: ((e: MessageEvent) => void) | null; postMessage: (m: unknown) => void };

ctx.onmessage = (e: MessageEvent<{ channels: Float32Array[]; sampleRate: number }>) => {
  try {
    const result = measureLoudness(e.data.channels, e.data.sampleRate, (p) => ctx.postMessage({ type: "progress", p }));
    ctx.postMessage({ type: "done", result });
  } catch (err) {
    ctx.postMessage({ type: "error", message: err instanceof Error ? err.message : "analysis failed" });
  }
};
