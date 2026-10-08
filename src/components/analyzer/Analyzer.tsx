"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { platformVerdicts, readWavInfo, type LoudnessResult } from "@/lib/audio/loudness";
import { track } from "@/components/site/Analytics";
import { OPEN_EVENT } from "@/components/agent/AgentWidget";

const MAX_BYTES = 500 * 1024 * 1024;

type FileInfo = { name: string; format: string; bitDepth: number | null };
type State =
  | { step: "idle" }
  | { step: "decoding" }
  | { step: "analyzing"; progress: number }
  | { step: "done"; result: LoudnessResult; file: FileInfo }
  | { step: "error"; error: "tooBig" | "decode" | "short" | "generic" };

export function Analyzer({ masteringPrice, agent }: { masteringPrice: string | null; agent: boolean }) {
  const t = useTranslations("analyzer");
  const locale = useLocale();
  const [state, setState] = useState<State>({ step: "idle" });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => () => workerRef.current?.terminate(), []);

  const fmt = useCallback(
    (n: number, digits = 1) => (Number.isFinite(n) ? n.toLocaleString(locale === "es" ? "es-DO" : "en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "−∞"),
    [locale],
  );

  const analyze = useCallback(async (file: File) => {
    if (file.size > MAX_BYTES) return setState({ step: "error", error: "tooBig" });
    setState({ step: "decoding" });
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
      channels = Array.from({ length: Math.min(2, audio.numberOfChannels) }, (_, i) => new Float32Array(audio.getChannelData(i)));
      if (audio.duration < 3) return setState({ step: "error", error: "short" });
    } catch {
      return setState({ step: "error", error: "decode" });
    }

    setState({ step: "analyzing", progress: 0 });
    workerRef.current?.terminate();
    const worker = new Worker(new URL("./analyzer.worker.ts", import.meta.url));
    workerRef.current = worker;
    worker.onmessage = (e: MessageEvent<{ type: "progress"; p: number } | { type: "done"; result: LoudnessResult } | { type: "error" }>) => {
      if (e.data.type === "progress") setState({ step: "analyzing", progress: e.data.p });
      else if (e.data.type === "done") {
        setState({ step: "done", result: e.data.result, file: info });
        track("click", window.location.pathname, "analyzed");
        worker.terminate();
      } else {
        setState({ step: "error", error: "generic" });
        worker.terminate();
      }
    };
    worker.onerror = () => setState({ step: "error", error: "generic" });
    worker.postMessage({ channels, sampleRate }, channels.map((c) => c.buffer));
  }, []);

  const pick = (files: FileList | null) => {
    const f = files?.[0];
    if (f) void analyze(f);
  };

  if (state.step === "done") {
    const r = state.result;
    const verdicts = platformVerdicts(r);
    const findings: { kind: "warn" | "info" | "ok"; text: string }[] = [];
    if (r.truePeak > -1) findings.push({ kind: "warn", text: t("f_peak", { tp: fmt(r.truePeak) }) });
    if (r.clippedRuns > 0) findings.push({ kind: "warn", text: t("f_clip", { count: r.clippedRuns }) });
    if (r.correlation !== null && r.correlation < 0) findings.push({ kind: "warn", text: t("f_phase", { c: fmt(r.correlation, 2) }) });
    const maxCut = Math.max(0, ...verdicts.map((v) => -v.change));
    if (r.integrated > -9) findings.push({ kind: "info", text: t("f_loud", { db: fmt(maxCut) }) });
    else if (r.integrated < -16) findings.push({ kind: "info", text: t("f_quiet") });
    if (findings.length === 0) findings.push({ kind: "ok", text: t("f_ok") });
    const minutes = Math.floor(r.duration / 60);
    const seconds = Math.round(r.duration % 60).toString().padStart(2, "0");

    return (
      <div data-testid="analyzer-result">
        <p className="text-sm text-ash">
          {t("file")}: <span className="text-bone">{state.file.name}</span> · {state.file.format} · {fmt(r.sampleRate / 1000, r.sampleRate % 1000 ? 1 : 0)} kHz
          {state.file.bitDepth ? ` · ${t("bits", { bits: state.file.bitDepth })}` : ""} · {r.channels > 1 ? t("stereo") : t("mono")} · {minutes}:{seconds}
        </p>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Metric label={t("integrated")} value={`${fmt(r.integrated)} LUFS`} hint={t("integratedHint")} big testId="lufs" />
          <Metric label={t("truePeak")} value={`${fmt(r.truePeak)} dBTP`} hint={t("truePeakHint")} warn={r.truePeak > -1} testId="true-peak" />
          <Metric label={t("lra")} value={`${fmt(r.lra)} LU`} hint={t("lraHint")} />
          <Metric label={t("shortTerm")} value={`${fmt(r.shortTermMax)} LUFS`} />
          <Metric label={t("plr")} value={`${fmt(r.truePeak - r.integrated)} dB`} hint={t("plrHint")} />
        </dl>

        <section className="mt-10" aria-labelledby="platforms">
          <h2 id="platforms" className="type-sub text-2xl">
            {t("platformsTitle")}
          </h2>
          <p className="mt-1 text-sm text-ash">{t("platformsHint")}</p>
          <ul className="mt-4 divide-y divide-rule border-y border-rule">
            {verdicts.map((v) => {
              const gap = v.target - r.integrated;
              const text =
                v.change < -0.05
                  ? t("down", { db: fmt(-v.change) })
                  : gap > 0.05 && !v.canReachTarget
                    ? v.change > 0.05
                      ? t("upLimited", { db: fmt(v.change), gap: fmt(gap - v.change) })
                      : t("noUp", { gap: fmt(gap) })
                    : v.change > 0.05
                      ? t("up", { db: fmt(v.change) })
                      : t("same");
              return (
                <li key={v.name} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3" data-platform={v.name}>
                  <span>
                    <span className="font-semibold">{v.name}</span> <span className="text-sm text-ash">· {t("target", { lufs: v.target })}</span>
                  </span>
                  <span className="text-sm text-bone/85">{text}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-10" aria-labelledby="findings">
          <h2 id="findings" className="type-sub text-2xl">
            {t("findingsTitle")}
          </h2>
          <ul className="mt-4 grid gap-3">
            {findings.map((f, i) => (
              <li
                key={i}
                className={`rounded-lg border px-4 py-3 ${
                  f.kind === "warn" ? "border-amber-400/40 bg-amber-500/10" : f.kind === "ok" ? "border-emerald-400/30 bg-emerald-500/10" : "border-rule"
                }`}
              >
                {f.text}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 rounded-xl bg-key p-6">
          <p className="type-sub text-2xl">{t("ctaTitle")}</p>
          <p className="mt-2 text-bone/80">{t("ctaBody")}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={`/${locale}/book?service=mastering`}
              onClick={() => track("click", window.location.pathname, "book-mastering")}
              className="inline-flex min-h-12 items-center rounded-full bg-bone px-6 font-semibold text-studio hover:bg-white"
            >
              {masteringPrice ? t("ctaBook", { price: masteringPrice }) : t("ctaBook", { price: "" }).replace(" ()", "")}
            </a>
            {agent && (
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
                className="inline-flex min-h-12 items-center rounded-full border border-bone/40 px-6 hover:bg-bone/5"
              >
                {t("ctaAgent")}
              </button>
            )}
          </div>
        </section>

        <button type="button" onClick={() => setState({ step: "idle" })} className="mt-8 text-sm text-ash underline underline-offset-4 hover:text-bone">
          {t("again")}
        </button>
      </div>
    );
  }

  const busy = state.step === "decoding" || state.step === "analyzing";
  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) pick(e.dataTransfer.files);
        }}
        className={`grid min-h-64 place-items-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          dragging ? "border-bone bg-bone/5" : "border-rule-key"
        }`}
      >
        {busy ? (
          <div className="w-full max-w-sm" role="status">
            <p>{state.step === "decoding" ? t("decoding") : t("analyzing", { percent: Math.round(state.progress * 100) })}</p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-key">
              <div
                className={`h-full rounded-full bg-bone transition-[width] ${state.step === "decoding" ? "w-1/3 animate-pulse" : ""}`}
                style={state.step === "analyzing" ? { width: `${Math.max(4, state.progress * 100)}%` } : undefined}
              />
            </div>
          </div>
        ) : (
          <div>
            <p className="type-sub text-2xl">{t("drop")}</p>
            <p className="mt-2 text-sm text-ash">{t("or")}</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-3 inline-flex min-h-12 items-center rounded-full bg-bone px-6 font-semibold text-studio hover:bg-white"
            >
              {t("choose")}
            </button>
            <p className="mt-4 text-xs text-ash">{t("formats")}</p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.wav,.aif,.aiff,.flac,.mp3,.m4a"
          className="sr-only"
          aria-label={t("choose")}
          data-testid="analyzer-input"
          onChange={(e) => {
            pick(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {state.step === "error" && (
        <p role="alert" className="mt-4 rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm">
          {t(`errors.${state.error}`)}
        </p>
      )}
      <p className="mt-4 text-sm text-ash">{t("privacy")}</p>
    </div>
  );
}

function Metric({ label, value, hint, big = false, warn = false, testId }: { label: string; value: string; hint?: string; big?: boolean; warn?: boolean; testId?: string }) {
  return (
    <div className={`rounded-xl border p-5 ${warn ? "border-amber-400/50" : "border-rule"} ${big ? "sm:col-span-2 lg:col-span-1" : ""}`}>
      <dt className="text-sm text-ash">{label}</dt>
      <dd className={`type-head num mt-2 ${big ? "text-5xl" : "text-4xl"} ${warn ? "text-amber-200" : ""}`} data-testid={testId}>
        {value}
      </dd>
      {hint && <dd className="mt-2 text-xs text-ash">{hint}</dd>}
    </div>
  );
}
