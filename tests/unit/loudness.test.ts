import { test } from "node:test";
import assert from "node:assert/strict";
import { measureLoudness, platformVerdicts, readWavInfo } from "../../src/lib/audio/loudness";

const FS = 48000;

function sine(freq: number, amp: number, seconds: number, phase = 0, fs = FS): Float32Array {
  const n = Math.round(seconds * fs);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = amp * Math.sin((2 * Math.PI * freq * i) / fs + phase);
  return x;
}
const near = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} expected ${b}±${tol}, got ${a}`);

test("EBU Tech 3341 case 1: stereo 1 kHz sine at −23 dBFS reads −23 LUFS", () => {
  const a = Math.pow(10, -23 / 20);
  const r = measureLoudness([sine(1000, a, 20), sine(1000, a, 20)], FS);
  near(r.integrated, -23, 0.1, "integrated");
  near(r.shortTermMax, -23, 0.1, "short-term");
  near(r.lra, 0, 0.1, "LRA");
  near(r.correlation ?? 0, 1, 0.001, "correlation");
});

test("EBU Tech 3341 case 2: −33 dBFS reads −33 LUFS, and works at 44.1 kHz", () => {
  const a = Math.pow(10, -33 / 20);
  near(measureLoudness([sine(1000, a, 20), sine(1000, a, 20)], FS).integrated, -33, 0.1);
  near(measureLoudness([sine(1000, a, 20, 0, 44100), sine(1000, a, 20, 0, 44100)], 44100).integrated, -33, 0.1);
});

test("gating ignores silence (EBU 3341 case 3 style: tone, silence, tone)", () => {
  const a = Math.pow(10, -23 / 20);
  const tone = sine(1000, a, 10);
  const silence = new Float32Array(10 * FS);
  const x = new Float32Array(tone.length * 2 + silence.length);
  x.set(tone, 0);
  x.set(silence, tone.length);
  x.set(tone, tone.length + silence.length);
  near(measureLoudness([x, x], FS).integrated, -23, 0.1);
});

test("true peak catches inter-sample peaks that sample peak misses", () => {
  // fs/4 sine at 45°: every sample sits at ±0.707 while the waveform reaches 1.0.
  const x = sine(FS / 4, 1, 2, Math.PI / 4);
  const r = measureLoudness([x, x], FS);
  near(r.samplePeak, -3.01, 0.05, "sample peak");
  near(r.truePeak, 0, 0.6, "true peak");
  assert.ok(r.truePeak > r.samplePeak + 2);
});

test("clipping runs are counted and out-of-phase stereo is detected", () => {
  const x = new Float32Array(FS * 2);
  for (let i = 0; i < x.length; i++) x[i] = Math.max(-1, Math.min(1, 1.5 * Math.sin((2 * Math.PI * 100 * i) / FS)));
  const inverted = x.map((v) => -v);
  const r = measureLoudness([x, inverted], FS);
  assert.ok(r.clippedRuns > 100);
  near(r.correlation ?? 0, -1, 0.001);
});

test("platform verdicts: loud masters are turned down; quiet ones only go up as far as the peaks allow", () => {
  const loud = platformVerdicts({ integrated: -8, truePeak: 0.2 });
  near(loud.find((p) => p.name === "Spotify")!.change, -6, 1e-9);
  near(loud.find((p) => p.name === "Apple Music")!.change, -8, 1e-9);

  const quiet = platformVerdicts({ integrated: -18, truePeak: -2 });
  const spotify = quiet.find((p) => p.name === "Spotify")!;
  assert.equal(spotify.change, 1); // only 1 dB of room before −1 dBTP
  assert.equal(spotify.canReachTarget, false);
  const youtube = quiet.find((p) => p.name === "YouTube")!;
  assert.equal(youtube.change, 0); // YouTube never turns songs up
});

test("WAV header reader", () => {
  const b = new Uint8Array(44);
  const v = new DataView(b.buffer);
  b.set([..."RIFF"].map((c) => c.charCodeAt(0)), 0);
  b.set([..."WAVE"].map((c) => c.charCodeAt(0)), 8);
  b.set([..."fmt "].map((c) => c.charCodeAt(0)), 12);
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 2, true);
  v.setUint32(24, 48000, true);
  v.setUint16(34, 24, true);
  assert.deepEqual(readWavInfo(b), { channels: 2, sampleRate: 48000, bitDepth: 24, float: false });
  assert.equal(readWavInfo(new Uint8Array(10)), null);
});
