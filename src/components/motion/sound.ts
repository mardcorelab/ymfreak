/**
 * Interface sounds, synthesised on the fly with Web Audio (no files): a soft
 * tick for taps, a low kick for jumps, a short airy rise for things opening.
 * Off by default; the visitor turns them on with the sound switch.
 */
export type UiSound = "tick" | "kick" | "rise";
export const SOUND_KEY = "ymf-sound";
export const SOUND_EVENT = "ymf:sound";

let ctx: AudioContext | null = null;

export function soundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === "on";
  } catch {
    return false;
  }
}

export function setSound(on: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    /* private mode: on for this page only */
  }
  window.dispatchEvent(new CustomEvent(SOUND_EVENT, { detail: on }));
  if (on) play("rise", true);
}

export function play(kind: UiSound, force = false): void {
  if (!force && !soundOn()) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.connect(ctx.destination);

    if (kind === "tick") {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(1850, t);
      o.frequency.exponentialRampToValueAtTime(900, t + 0.04);
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.05, t + 0.004);
      out.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(out);
      o.start(t);
      o.stop(t + 0.08);
    } else if (kind === "kick") {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.22, t + 0.006);
      out.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      o.connect(out);
      o.start(t);
      o.stop(t + 0.34);
    } else {
      // A breath of filtered noise sweeping up, with a little tail.
      const len = Math.floor(ctx.sampleRate * 0.45);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = "bandpass";
      f.Q.value = 3;
      f.frequency.setValueAtTime(500, t);
      f.frequency.exponentialRampToValueAtTime(4200, t + 0.35);
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.06, t + 0.08);
      out.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      src.connect(f).connect(out);
      src.start(t);
    }
  } catch {
    /* no audio available */
  }
}
