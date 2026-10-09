"use client";

import { readWavInfo, type LoudnessResult } from "@/lib/audio/loudness";

export const MAX_AUDIO_BYTES = 500 * 1024 * 1024;

export type FileInfo = { name: string; format: string; bitDepth: number | null };
export class AnalyzeError extends Error {
  constructor(readonly code: "tooBig" | "decode" | "short" | "generic") {
    super(code);
  }
}

/**
 * Decodes an audio file in the browser and measures it in a Web Worker.
 * Nothing is uploaded. Used by the analyzer page and by the assistant chat.
 */
export async function analyzeAudioFile(
  file: File,
  onProgress: (step: "decoding" | "analyzing", p: number) => void,
): Promise<{ result: LoudnessResult; info: FileInfo }> {
  if (file.size > MAX_AUDIO_BYTES) throw new AnalyzeError("tooBig");
  onProgress("decoding", 0);
  let channels: Float32Array[];
  let sampleRate: number;
  let info: FileInfo;
  try {
    const buffer = await file.arrayBuffer();
    const wav = readWavInfo(new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 1 << 16)));
    const ext = file.name.split(".").pop()?.toUpperCase() ?? "";
    info = { name: file.name, format: wav ? "WAV" : ext, bitDepth: wav?.bitDepth ?? null };
    // Decode at the file's own rate when we know it, so nothing is resampled.
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    let ctx: AudioContext;
    try {
      ctx = new Ctx({ sampleRate: wav?.sampleRate ?? 48000 });
    } catch {
      ctx = new Ctx();
    }
    const audio = await ctx.decodeAudioData(buffer);
    void ctx.close();
    sampleRate = audio.sampleRate;
    if (audio.duration < 3) throw new AnalyzeError("short");
    channels = Array.from({ length: Math.min(2, audio.numberOfChannels) }, (_, i) => new Float32Array(audio.getChannelData(i)));
  } catch (e) {
    throw e instanceof AnalyzeError ? e : new AnalyzeError("decode");
  }

  onProgress("analyzing", 0);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./analyzer.worker.ts", import.meta.url));
    worker.onmessage = (e: MessageEvent<{ type: "progress"; p: number } | { type: "done"; result: LoudnessResult } | { type: "error" }>) => {
      if (e.data.type === "progress") onProgress("analyzing", e.data.p);
      else {
        worker.terminate();
        if (e.data.type === "done") resolve({ result: e.data.result, info });
        else reject(new AnalyzeError("generic"));
      }
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new AnalyzeError("generic"));
    };
    worker.postMessage({ channels, sampleRate }, channels.map((c) => c.buffer));
  });
}
