/**
 * Loudness measurement after ITU-R BS.1770-4 / EBU R128, in plain TypeScript
 * so it runs in the visitor's browser (the audio never leaves their device).
 * Unit-tested against the EBU reference signals.
 *
 *  - Integrated loudness (LUFS): K-weighting, 400 ms blocks with 75 % overlap,
 *    absolute gate −70 LUFS, relative gate −10 LU.
 *  - Short-term (3 s) and momentary (400 ms) maxima.
 *  - Loudness range (LRA, EBU Tech 3342): short-term values, −20 LU relative
 *    gate, 10th–95th percentile.
 *  - True peak (dBTP): 4× oversampling with a windowed-sinc interpolator.
 */

export interface LoudnessResult {
  integrated: number; // LUFS, -Infinity for silence
  shortTermMax: number;
  momentaryMax: number;
  lra: number; // LU
  truePeak: number; // dBTP
  samplePeak: number; // dBFS
  /** Stereo correlation from -1 (out of phase) to 1 (mono). Null for mono files. */
  correlation: number | null;
  /** Runs of 3+ consecutive samples at full scale: a sign of clipping. */
  clippedRuns: number;
  duration: number; // seconds
  sampleRate: number;
  channels: number;
}

type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number };

/** K-weighting filter coefficients for any sample rate (shelf + high-pass, as in libebur128). */
export function kWeighting(fs: number): [Biquad, Biquad] {
  let f0 = 1681.974450955533;
  const G = 3.999843853973347;
  let Q = 0.7071752369554196;
  let K = Math.tan((Math.PI * f0) / fs);
  const Vh = Math.pow(10, G / 20);
  const Vb = Math.pow(Vh, 0.4996667741545416);
  let a0 = 1 + K / Q + K * K;
  const shelf: Biquad = {
    b0: (Vh + (Vb * K) / Q + K * K) / a0,
    b1: (2 * (K * K - Vh)) / a0,
    b2: (Vh - (Vb * K) / Q + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q + K * K) / a0,
  };
  f0 = 38.13547087602444;
  Q = 0.5003270373238773;
  K = Math.tan((Math.PI * f0) / fs);
  a0 = 1 + K / Q + K * K;
  const highpass: Biquad = { b0: 1, b1: -2, b2: 1, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q + K * K) / a0 };
  return [shelf, highpass];
}

const LOG_OFFSET = -0.691;
const toLufs = (energy: number) => (energy > 0 ? LOG_OFFSET + 10 * Math.log10(energy) : -Infinity);
const toDb = (amp: number) => (amp > 0 ? 20 * Math.log10(amp) : -Infinity);

/** K-weighted energy summed into 100 ms sub-blocks (channels added together, weight 1 each). */
function energies(channels: Float32Array[], fs: number, onProgress?: (p: number) => void): Float64Array {
  const hop = Math.round(fs / 10);
  const n = channels[0]!.length;
  const count = Math.floor(n / hop);
  const sums = new Float64Array(count);
  const [s, h] = kWeighting(fs);
  const total = channels.length * count * hop;
  let done = 0;
  for (const x of channels) {
    let sx1 = 0, sx2 = 0, sy1 = 0, sy2 = 0;
    let hy1 = 0, hy2 = 0, hx1 = 0, hx2 = 0;
    for (let b = 0; b < count; b++) {
      let acc = 0;
      const end = (b + 1) * hop;
      for (let i = b * hop; i < end; i++) {
        const xi = x[i]!;
        const y = s.b0 * xi + s.b1 * sx1 + s.b2 * sx2 - s.a1 * sy1 - s.a2 * sy2;
        sx2 = sx1; sx1 = xi; sy2 = sy1; sy1 = y;
        const z = h.b0 * y + h.b1 * hx1 + h.b2 * hx2 - h.a1 * hy1 - h.a2 * hy2;
        hx2 = hx1; hx1 = y; hy2 = hy1; hy1 = z;
        acc += z * z;
      }
      sums[b]! += acc;
      done += hop;
      if (onProgress && b % 600 === 0) onProgress((0.6 * done) / total);
    }
  }
  return sums;
}

/** Mean energy of windows of `len` sub-blocks, stepping one sub-block (100 ms) at a time. */
function windowEnergies(sub: Float64Array, len: number, hopSamples: number): number[] {
  const out: number[] = [];
  if (sub.length < len) return out;
  let acc = 0;
  for (let i = 0; i < len; i++) acc += sub[i]!;
  out.push(acc / (len * hopSamples));
  for (let i = len; i < sub.length; i++) {
    acc += sub[i]! - sub[i - len]!;
    out.push(Math.max(0, acc) / (len * hopSamples));
  }
  return out;
}

function gatedIntegrated(blocks: number[]): number {
  const abs = blocks.filter((e) => toLufs(e) > -70);
  if (abs.length === 0) return -Infinity;
  const rel = toLufs(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
  const kept = abs.filter((e) => toLufs(e) > rel);
  return kept.length ? toLufs(kept.reduce((a, b) => a + b, 0) / kept.length) : -Infinity;
}

function loudnessRange(shortTerm: number[]): number {
  const abs = shortTerm.filter((e) => toLufs(e) > -70);
  if (abs.length < 2) return 0;
  const rel = toLufs(abs.reduce((a, b) => a + b, 0) / abs.length) - 20;
  const values = abs
    .map(toLufs)
    .filter((l) => l > rel)
    .sort((a, b) => a - b);
  if (values.length < 2) return 0;
  const pct = (p: number) => values[Math.min(values.length - 1, Math.max(0, Math.round((p / 100) * (values.length - 1))))]!;
  return pct(95) - pct(10);
}

/** 4× oversampling interpolator: 48-tap windowed sinc, split into 4 phases of 12 taps. */
const OVERSAMPLE = 4;
const TAPS = 48;
const PHASES: Float64Array[] = (() => {
  const h = new Float64Array(TAPS);
  const mid = (TAPS - 1) / 2;
  for (let n = 0; n < TAPS; n++) {
    const t = (n - mid) / OVERSAMPLE;
    const sinc = t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t);
    const w = 0.42 - 0.5 * Math.cos((2 * Math.PI * n) / (TAPS - 1)) + 0.08 * Math.cos((4 * Math.PI * n) / (TAPS - 1)); // Blackman
    h[n] = sinc * w;
  }
  const phases: Float64Array[] = [];
  for (let p = 0; p < OVERSAMPLE; p++) {
    const taps = new Float64Array(TAPS / OVERSAMPLE);
    let sum = 0;
    for (let k = 0; k < taps.length; k++) {
      taps[k] = h[k * OVERSAMPLE + p]!;
      sum += taps[k]!;
    }
    for (let k = 0; k < taps.length; k++) taps[k]! /= sum; // unity gain per phase
    phases.push(taps);
  }
  return phases;
})();

function truePeakOf(x: Float32Array): number {
  let peak = 0;
  const L = TAPS / OVERSAMPLE;
  for (let m = L; m < x.length; m++) {
    for (const taps of PHASES) {
      let acc = 0;
      for (let k = 0; k < L; k++) acc += taps[k]! * x[m - k]!;
      const a = acc < 0 ? -acc : acc;
      if (a > peak) peak = a;
    }
  }
  return peak;
}

export function measureLoudness(channels: Float32Array[], sampleRate: number, onProgress?: (p: number) => void): LoudnessResult {
  if (channels.length === 0 || channels[0]!.length === 0) throw new Error("empty audio");
  // Measure at most two channels (stereo); multichannel files use the front pair.
  const ch = channels.slice(0, 2);
  const hop = Math.round(sampleRate / 10);
  const sub = energies(ch, sampleRate, onProgress);

  const momentary = windowEnergies(sub, 4, hop);
  const shortTerm = windowEnergies(sub, 30, hop);
  const integrated = gatedIntegrated(momentary);

  let samplePeak = 0;
  let clippedRuns = 0;
  for (const x of ch) {
    let run = 0;
    for (let i = 0; i < x.length; i++) {
      const a = Math.abs(x[i]!);
      if (a > samplePeak) samplePeak = a;
      if (a >= 0.9999) {
        run++;
        if (run === 3) clippedRuns++;
      } else run = 0;
    }
  }
  onProgress?.(0.65);

  let truePeak = 0;
  ch.forEach((x, i) => {
    truePeak = Math.max(truePeak, truePeakOf(x));
    onProgress?.(0.65 + (0.33 * (i + 1)) / ch.length);
  });
  truePeak = Math.max(truePeak, samplePeak);

  let correlation: number | null = null;
  if (ch.length === 2) {
    const [l, r] = ch as [Float32Array, Float32Array];
    let lr = 0, ll = 0, rr = 0;
    for (let i = 0; i < l.length; i++) {
      lr += l[i]! * r[i]!;
      ll += l[i]! * l[i]!;
      rr += r[i]! * r[i]!;
    }
    correlation = ll > 0 && rr > 0 ? lr / Math.sqrt(ll * rr) : null;
  }
  onProgress?.(1);

  return {
    integrated,
    shortTermMax: shortTerm.length ? toLufs(Math.max(...shortTerm)) : integrated,
    momentaryMax: momentary.length ? toLufs(Math.max(...momentary)) : integrated,
    lra: loudnessRange(shortTerm),
    truePeak: toDb(truePeak),
    samplePeak: toDb(samplePeak),
    correlation,
    clippedRuns,
    duration: channels[0]!.length / sampleRate,
    sampleRate,
    channels: channels.length,
  };
}

/** Loudness targets of the main platforms (integrated LUFS) and whether they raise quiet songs. */
export const PLATFORM_TARGETS = [
  { name: "Spotify", target: -14, turnsUp: true },
  { name: "YouTube", target: -14, turnsUp: false },
  { name: "Apple Music", target: -16, turnsUp: false },
  { name: "TIDAL", target: -14, turnsUp: true },
  { name: "Amazon Music", target: -14, turnsUp: true },
  { name: "Deezer", target: -15, turnsUp: true },
] as const;

export interface PlatformVerdict {
  name: string;
  target: number;
  /** dB the platform changes the song's level: negative = turned down. */
  change: number;
  /** For quiet songs on platforms that raise them: false when the peaks don't leave room (it will play quieter than others). */
  canReachTarget: boolean;
}

export function platformVerdicts(r: Pick<LoudnessResult, "integrated" | "truePeak">): PlatformVerdict[] {
  return PLATFORM_TARGETS.map((p) => {
    const gap = p.target - r.integrated;
    if (!Number.isFinite(gap)) return { name: p.name, target: p.target, change: 0, canReachTarget: false };
    if (gap <= 0) return { name: p.name, target: p.target, change: gap, canReachTarget: true };
    if (!p.turnsUp) return { name: p.name, target: p.target, change: 0, canReachTarget: false };
    // Raising is limited so peaks stay under −1 dBTP.
    const room = -1 - r.truePeak;
    const change = Math.max(0, Math.min(gap, room));
    return { name: p.name, target: p.target, change, canReachTarget: change >= gap - 0.05 };
  });
}

/** Minimal WAV header reader: format details for the report (no audio decoding). */
export function readWavInfo(bytes: Uint8Array): { sampleRate: number; bitDepth: number; channels: number; float: boolean } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o: number) => String.fromCharCode(bytes[o]!, bytes[o + 1]!, bytes[o + 2]!, bytes[o + 3]!);
  if (bytes.length < 44 || tag(0) !== "RIFF" || tag(8) !== "WAVE") return null;
  let o = 12;
  while (o + 8 <= bytes.length) {
    const id = tag(o);
    const size = view.getUint32(o + 4, true);
    if (id === "fmt " && o + 24 <= bytes.length) {
      const format = view.getUint16(o + 8, true);
      return {
        channels: view.getUint16(o + 10, true),
        sampleRate: view.getUint32(o + 12, true),
        bitDepth: view.getUint16(o + 22, true),
        float: format === 3 || (format === 0xfffe && view.getUint16(o + 22, true) === 32),
      };
    }
    o += 8 + size + (size % 2);
  }
  return null;
}
