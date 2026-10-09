"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { track } from "@/components/site/Analytics";
import { Monogram } from "@/components/brand/Logo";
import { platformVerdicts } from "@/lib/audio/loudness";
import { AnalyzeError, analyzeAudioFile } from "@/components/analyzer/analyze";
import { AGENT_LIMITS, type AgentCard, type ChatItem, type ChatResponse, type ConfirmResponse } from "@/lib/agent-types";

const STORAGE_KEY = "ymf-agent-conversation";

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
function writeStored(id: string | null) {
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable: the chat still works for this visit */
  }
}

/** Which part of the site the visitor is on, so the assistant can greet and suggest accordingly. */
const PAGES = ["services", "book", "analyzer", "portfolio", "release", "account", "checkout", "faq", "contact", "press", "about", "achievements", "links"] as const;
type PageKey = (typeof PAGES)[number] | "home" | "other";
function pageKeyOf(path: string): PageKey {
  const seg = path.replace(/^\/(es|en)/, "").split("/")[1] ?? "";
  if (seg === "") return "home";
  if (seg === "r") return "release";
  return (PAGES as readonly string[]).includes(seg) ? (seg as PageKey) : "other";
}
/** Pages with their own greeting, suggestions and a gentle nudge. */
const GUIDED: PageKey[] = ["home", "services", "book", "analyzer", "portfolio", "release", "account"];
const NUDGE: PageKey[] = ["services", "book", "analyzer", "release"];
const NUDGE_KEY = "ymf-agent-nudged";

/** Opens the assistant from anywhere on the site: window.dispatchEvent(new Event("ymf:agent-open")). */
export const OPEN_EVENT = "ymf:agent-open";

type Item = ChatItem & { local?: boolean };
const MAX_NOTE_SECONDS = 120;

export function AgentWidget({ name = "", voice = false }: { name?: string; voice?: boolean }) {
  const t = useTranslations("agent");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [userCount, setUserCount] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname() ?? "";
  const page = pageKeyOf(pathname);
  const guided = GUIDED.includes(page);
  // The link-in-bio page has its own button for the assistant.
  const hideLauncher = page === "links";
  const [firstName, setFirstName] = useState<string | null>(null);
  const [nudge, setNudge] = useState(false);
  const [analyzing, setAnalyzing] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Voice notes (only when the studio switched voice on).
  const [recording, setRecording] = useState<number | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const recorderRef = useRef<{ rec: MediaRecorder; stream: MediaStream; chunks: Blob[]; keep: boolean; timer: ReturnType<typeof setInterval> } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // A returning client signed in to "My account" is greeted by name.
  useEffect(() => {
    if (!open) return;
    fetch("/api/agent/me", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ firstName: string | null }>)
      .then((d) => setFirstName(d.firstName))
      .catch(() => undefined);
  }, [open]);

  // On pages where people decide, offer help once per visit after a while.
  useEffect(() => {
    setNudge(false);
    if (open || !NUDGE.includes(page)) return;
    try {
      if (window.sessionStorage.getItem(NUDGE_KEY)) return;
    } catch {
      /* no storage: still fine */
    }
    const timer = setTimeout(() => setNudge(true), 20_000);
    return () => clearTimeout(timer);
  }, [page, open]);
  const dismissNudge = () => {
    setNudge(false);
    try {
      window.sessionStorage.setItem(NUDGE_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  // Restore the previous conversation the first time the panel opens.
  useEffect(() => {
    if (!open || restored) return;
    setRestored(true);
    const id = readStored();
    if (!id) return;
    fetch(`/api/agent/chat?c=${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ ok: true; conversationId: string; items: ChatItem[] }>) : null))
      .then((data) => {
        if (!data?.ok) return writeStored(null);
        setConversationId(data.conversationId);
        setItems(data.items);
        setUserCount(data.items.filter((i) => i.type === "text" && i.role === "user").length);
      })
      .catch(() => undefined);
  }, [open, restored]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        launcherRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items, busy, open]);

  const say = useCallback((text: string) => setItems((prev): Item[] => [...prev, { type: "text", role: "assistant", text, local: true }]), []);

  const stopPlaying = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlaying(null);
  }, []);

  /** Plays one of the assistant's replies in the studio's AI voice. */
  const play = useCallback(
    async (text: string, convId: string | null) => {
      stopPlaying();
      if (!convId) return;
      setPlaying(text);
      try {
        const res = await fetch("/api/agent/voice/speak", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId: convId, text }) });
        if (!res.ok) throw new Error(String(res.status));
        const url = URL.createObjectURL(await res.blob());
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          if (audioRef.current === audio) stopPlaying();
        };
        await audio.play();
      } catch {
        setPlaying(null);
      }
    },
    [stopPlaying],
  );

  const send = useCallback(
    async (raw: string, opts?: { voice?: boolean }) => {
      const text = raw.trim();
      if (!text || busy) return;
      if (text.length > AGENT_LIMITS.messageChars) return say(t("errors.TOO_LONG"));
      setItems((prev) => [...prev, { type: "text", role: "user", text }]);
      setUserCount((c) => c + 1);
      setInput("");
      setBusy(true);
      try {
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ conversationId, text, locale, page }),
        });
        const data = (await res.json()) as ChatResponse;
        if (data.conversationId) {
          setConversationId(data.conversationId);
          writeStored(data.conversationId);
        }
        if (data.ok) {
          setItems((prev) => [...prev, ...data.items]);
          // A voice note gets a spoken answer.
          const reply = opts?.voice ? [...data.items].reverse().find((i) => i.type === "text" && i.role === "assistant") : undefined;
          if (reply && reply.type === "text") void play(reply.text, data.conversationId ?? conversationId);
        } else say(t(`errors.${data.error}`));
      } catch {
        say(t("errors.network"));
      } finally {
        setBusy(false);
        inputRef.current?.focus();
      }
    },
    [busy, conversationId, locale, page, play, say, t],
  );

  const finishRecording = useCallback(
    async (keep: boolean) => {
      const r = recorderRef.current;
      if (!r) return;
      r.keep = keep;
      clearInterval(r.timer);
      if (r.rec.state !== "inactive") r.rec.stop();
    },
    [],
  );

  const startRecording = useCallback(async () => {
    if (recorderRef.current || busy) return;
    stopPlaying();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return say(t("voice.errors.mic"));
    }
    const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m));
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    } catch {
      stream.getTracks().forEach((tr) => tr.stop());
      return say(t("voice.errors.mic"));
    }
    const started = Date.now();
    const state = {
      rec,
      stream,
      chunks: [] as Blob[],
      keep: true,
      timer: setInterval(() => {
        const secs = Math.floor((Date.now() - started) / 1000);
        setRecording(secs);
        if (secs >= MAX_NOTE_SECONDS) void finishRecording(true);
      }, 250),
    };
    recorderRef.current = state;
    rec.ondataavailable = (e) => e.data.size > 0 && state.chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((tr) => tr.stop());
      recorderRef.current = null;
      setRecording(null);
      if (!state.keep) return;
      const blob = new Blob(state.chunks, { type: rec.mimeType || type || "audio/webm" });
      if (blob.size === 0) return say(t("voice.errors.EMPTY"));
      setTranscribing(true);
      try {
        const form = new FormData();
        form.append("audio", blob, "nota");
        form.append("locale", locale);
        const res = await fetch("/api/agent/voice/transcribe", { method: "POST", body: form });
        const data = (await res.json()) as { ok: true; text: string } | { ok: false; error: string };
        setTranscribing(false);
        if (!data.ok) return say(t(["EMPTY", "TOO_BIG", "RATE_LIMITED"].includes(data.error) ? `voice.errors.${data.error}` : "voice.errors.generic"));
        track("click", window.location.pathname, "chat-voice-note");
        await send(data.text, { voice: true });
      } catch {
        setTranscribing(false);
        say(t("errors.network"));
      }
    };
    rec.start(1000);
    setRecording(0);
  }, [busy, finishRecording, locale, say, send, stopPlaying, t]);

  // Release the microphone and audio if the panel closes.
  useEffect(() => {
    if (open) return;
    void finishRecording(false);
    stopPlaying();
  }, [open, finishRecording, stopPlaying]);

  const decide = useCallback(
    async (actionId: string, decision: "confirm" | "dismiss") => {
      if (!conversationId) return;
      setBusy(true);
      try {
        const res = await fetch("/api/agent/confirm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ conversationId, actionId, decision, locale }),
        });
        const data = (await res.json()) as ConfirmResponse;
        const state: "confirmed" | "dismissed" | "expired" = data.ok ? (decision === "confirm" ? "confirmed" : "dismissed") : "expired";
        setItems((prev) => [
          ...prev.map((i) =>
            i.type === "card" && i.card.kind === "proposal" && i.card.actionId === actionId ? { type: "card" as const, card: { ...i.card, state } } : i,
          ),
          ...(data.items ?? []),
        ]);
        if (!data.ok && !data.items?.length) {
          const known = ["NOT_FOUND", "EXPIRED", "ALREADY_DONE", "BOOKING_CLOSED", "RATE_LIMITED", "INVALID"];
          say(t(`confirmErrors.${known.includes(data.error) ? data.error : "generic"}`));
        }
      } catch {
        say(t("errors.network"));
      } finally {
        setBusy(false);
      }
    },
    [conversationId, locale, say, t],
  );

  /** Measures a song in the browser and sends the numbers to the assistant. */
  const analyzeSong = useCallback(
    async (file: File) => {
      if (busy) return;
      setAnalyzing(0);
      try {
        const { result: r } = await analyzeAudioFile(file, (step, p) => setAnalyzing(step === "decoding" ? 0 : p));
        const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString(locale === "es" ? "es-DO" : "en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) : "−∞");
        const spotify = platformVerdicts(r).find((v) => v.name === "Spotify")!;
        const gap = spotify.target - r.integrated;
        const spotifyText =
          spotify.change < -0.05
            ? t("analysis.down", { db: fmt(-spotify.change) })
            : gap > 0.05 && !spotify.canReachTarget
              ? t("analysis.quieter", { db: fmt(gap - spotify.change) })
              : spotify.change > 0.05
                ? t("analysis.up", { db: fmt(spotify.change) })
                : t("analysis.same");
        setAnalyzing(null);
        track("click", window.location.pathname, "chat-analyzed");
        await send(
          t("analysis.message", {
            file: file.name.slice(0, 80),
            lufs: fmt(r.integrated),
            tp: fmt(r.truePeak),
            lra: fmt(r.lra),
            clip: r.clippedRuns > 0 ? t("analysis.clip", { count: r.clippedRuns }) : "",
            spotify: spotifyText,
          }),
        );
      } catch (e) {
        setAnalyzing(null);
        const code = e instanceof AnalyzeError ? e.code : "generic";
        say(t(`analysis.errors.${code}`));
      }
    },
    [busy, locale, say, send, t],
  );

  const reset = () => {
    writeStored(null);
    setConversationId(null);
    setItems([]);
    setUserCount(0);
    inputRef.current?.focus();
  };

  const atLimit = userCount >= AGENT_LIMITS.userMessagesPerConversation;

  return (
    <>
      {!open && !hideLauncher && nudge && (
        <div className="fixed right-4 bottom-[5.25rem] z-40 flex max-w-[17rem] items-start gap-2 rounded-xl border border-rule-key bg-studio-deep p-3 text-sm shadow-[0_10px_30px_rgba(0,0,0,0.5)] sm:right-6 sm:bottom-[5.75rem]" role="status">
          <button
            type="button"
            onClick={() => {
              dismissNudge();
              setOpen(true);
              track("agent_open");
            }}
            className="text-left text-bone/90 hover:text-bone"
          >
            {t(`pages.${page}.nudge`)}
          </button>
          <button type="button" onClick={dismissNudge} aria-label={t("close")} className="-mt-1 -mr-1 grid size-7 shrink-0 place-items-center rounded-full text-ash hover:text-bone">
            <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}
      {!open && !hideLauncher && (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => {
            dismissNudge();
            setOpen(true);
            track("agent_open");
          }}
          className="plate group fixed right-4 bottom-4 z-40 inline-flex min-h-14 items-center gap-3 rounded-xl py-2 pr-4 pl-2.5 text-left transition hover:brightness-110 active:scale-[0.98] sm:right-6 sm:bottom-6 sm:pr-5"
          aria-haspopup="dialog"
          aria-label={`${t("open")} · ${t("openSub")}`}
        >
          <span aria-hidden className="plate-rivet absolute top-1.5 right-1.5" />
          <span aria-hidden className="plate-rivet absolute right-1.5 bottom-1.5" />
          <span
            aria-hidden
            className="grid size-10 shrink-0 place-items-center rounded-lg bg-black text-white shadow-[inset_0_1px_3px_rgba(0,0,0,0.8),0_1px_0_rgba(255,255,255,0.5)]"
          >
            <Monogram className="w-[62%]" />
          </span>
          <span aria-hidden className="grid leading-tight">
            <span className="plate-stamp type-head text-[0.82rem] sm:text-[0.9rem]">
              <span className="hidden sm:inline">{t("open")}</span>
              <span className="sm:hidden">{t("openShort")}</span>
            </span>
            <span className="plate-stamp hidden text-[0.72rem] font-semibold opacity-80 sm:block">{t("openSub")}</span>
          </span>
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={name || t("title")}
          className="fixed inset-0 z-50 flex flex-col bg-studio-deep sm:inset-auto sm:right-6 sm:bottom-6 sm:h-[min(680px,calc(100dvh-3rem))] sm:w-[400px] sm:rounded-2xl sm:border sm:border-rule sm:shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
        >
          <header className="flex items-center gap-3 border-b border-rule px-4 py-3">
            <span aria-hidden className="grid size-9 place-items-center rounded-full bg-black text-white ring-1 ring-rule-key">
              <Monogram className="w-[60%]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="type-head text-base leading-tight">{name || t("title")}</p>
              <p className="truncate text-xs text-ash">{t("subtitle")}</p>
            </div>
            {items.length > 0 && (
              <button type="button" onClick={reset} className="min-h-10 rounded-full px-3 text-xs text-ash hover:bg-bone/5 hover:text-bone">
                {t("newChat")}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                launcherRef.current?.focus();
              }}
              aria-label={t("close")}
              className="grid size-10 place-items-center rounded-full text-ash hover:bg-bone/5 hover:text-bone"
            >
              <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite" data-testid="agent-log">
            <Bubble role="assistant">
              {firstName ? t("welcomeBack", { first: firstName }) : name ? t("greetingNamed", { name }) : t("greeting")}
            </Bubble>
            {items.length === 0 && guided && page !== "home" && <Bubble role="assistant">{t(`pages.${page}.hint`)}</Bubble>}
            {items.length === 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {(["s1", "s2", "s3"] as const).map((k) => {
                  const label = guided ? t(`pages.${page}.${k}`) : t(`suggestions.${k}`);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => send(label)}
                      className="min-h-10 rounded-full border border-rule-key px-3.5 text-left text-sm text-bone/90 hover:border-bone/60 hover:bg-bone/5"
                    >
                      {label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="min-h-10 rounded-full border border-dashed border-rule-key px-3.5 text-left text-sm text-bone/90 hover:border-bone/60 hover:bg-bone/5"
                >
                  {t("analysis.suggest")}
                </button>
              </div>
            )}
            {items.map((item, i) =>
              item.type === "text" ? (
                <div key={i}>
                  <Bubble role={item.role}>{item.text}</Bubble>
                  {voice && item.role === "assistant" && !item.local && conversationId && (
                    <button
                      type="button"
                      onClick={() => (playing === item.text ? stopPlaying() : void play(item.text, conversationId))}
                      aria-label={playing === item.text ? t("voice.stopPlay") : t("voice.listenLabel")}
                      className="mt-1 inline-flex min-h-8 items-center gap-1.5 rounded-full px-2 text-xs text-ash hover:bg-bone/5 hover:text-bone"
                    >
                      <svg viewBox="0 0 20 20" className="size-3.5" aria-hidden>
                        {playing === item.text ? (
                          <path d="M6 5h3v10H6zM11 5h3v10h-3z" fill="currentColor" />
                        ) : (
                          <path d="M3 8v4h3l4 3V5L6 8H3zm10-1a4 4 0 010 6m2-8a7 7 0 010 10" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" />
                        )}
                      </svg>
                      {playing === item.text ? t("voice.stopPlay") : t("voice.listen")}
                      <span className="text-ash/70">· {t("voice.aiVoice")}</span>
                    </button>
                  )}
                </div>
              ) : (
                <Card key={i} card={item.card} busy={busy} onSend={send} onDecide={decide} />
              ),
            )}
            {analyzing !== null && (
              <p className="text-sm text-ash" role="status">
                {t("analysis.progress", { percent: Math.round(analyzing * 100) })}
              </p>
            )}
            {transcribing && (
              <p className="text-sm text-ash" role="status">
                {t("voice.transcribing")}
              </p>
            )}
            {busy && (
              <p className="flex items-center gap-2 text-sm text-ash" role="status">
                <span className="inline-flex gap-1" aria-hidden>
                  <Dot d="0ms" />
                  <Dot d="150ms" />
                  <Dot d="300ms" />
                </span>
                {t("thinking")}
              </p>
            )}
          </div>

          <form
            className="border-t border-rule px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            {atLimit ? (
              <p className="px-1 pb-2 text-sm text-ash">{t("errors.CONVERSATION_LIMIT")}</p>
            ) : recording !== null ? (
              <div className="flex items-center gap-2" data-testid="agent-recording">
                <button
                  type="button"
                  onClick={() => void finishRecording(false)}
                  className="min-h-11 rounded-full px-3 text-sm text-ash hover:bg-bone/5 hover:text-bone"
                >
                  {t("voice.cancel")}
                </button>
                <p className="flex flex-1 items-center gap-2 text-sm" role="status">
                  <span aria-hidden className="size-2.5 animate-pulse rounded-full bg-red-500 motion-reduce:animate-none" />
                  {t("voice.recording", { time: `${Math.floor(recording / 60)}:${String(recording % 60).padStart(2, "0")}` })}
                </p>
                <button
                  type="button"
                  onClick={() => void finishRecording(true)}
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-bone text-studio transition hover:bg-white"
                  aria-label={t("voice.stop")}
                >
                  <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
                    <path d="M4 10h11M10 5l5 5-5 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy || analyzing !== null}
                  aria-label={t("analysis.attach")}
                  title={t("analysis.attach")}
                  className="grid size-11 shrink-0 place-items-center rounded-full border border-rule-key text-ash transition hover:border-bone/60 hover:text-bone disabled:opacity-40"
                >
                  <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
                    <path d="M3 10v0M6 7v6M9 4v12M12 7v6M15 9v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="audio/*,.wav,.aif,.aiff,.flac,.mp3,.m4a"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  data-testid="agent-audio-input"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void analyzeSong(f);
                  }}
                />
                <label htmlFor="agent-input" className="sr-only">
                  {t("placeholder")}
                </label>
                <textarea
                  id="agent-input"
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void send(input);
                    }
                  }}
                  rows={1}
                  maxLength={AGENT_LIMITS.messageChars}
                  placeholder={t("placeholder")}
                  className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-rule-key bg-studio px-4 py-2.5 text-base text-bone placeholder:text-ash/70 focus:border-bone/60 focus:outline-none"
                />
                {voice && !input.trim() ? (
                  <button
                    type="button"
                    onClick={() => void startRecording()}
                    disabled={busy || transcribing || analyzing !== null}
                    className="grid size-11 shrink-0 place-items-center rounded-full bg-bone text-studio transition hover:bg-white disabled:opacity-40"
                    aria-label={t("voice.record")}
                    title={t("voice.record")}
                  >
                    <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
                      <rect x="7" y="2.5" width="6" height="10" rx="3" fill="currentColor" />
                      <path d="M4.5 9.5a5.5 5.5 0 0011 0M10 15v3" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                    </svg>
                  </button>
                ) : (
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-bone text-studio transition hover:bg-white disabled:opacity-40"
                  aria-label={t("send")}
                >
                  <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
                    <path d="M4 10h11M10 5l5 5-5 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                )}
              </div>
            )}
            <p className="mt-2 px-1 text-[0.7rem] leading-snug text-ash/80">{t("disclaimer")}</p>
          </form>
        </div>
      )}
    </>
  );
}

function Dot({ d }: { d: string }) {
  return <span className="size-1.5 animate-pulse rounded-full bg-ash motion-reduce:animate-none" style={{ animationDelay: d }} />;
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  return role === "user" ? (
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-2xl rounded-br-md bg-bone px-4 py-2.5 text-[0.95rem] whitespace-pre-wrap text-studio" data-role="user">
        {children}
      </p>
    </div>
  ) : (
    <p className="max-w-[92%] text-[0.95rem] leading-relaxed whitespace-pre-wrap text-bone/95" data-role="assistant">
      {children}
    </p>
  );
}

function Rows({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="mt-3 space-y-1.5 text-sm">
      {rows.map((r, i) => (
        <div key={i} className="flex justify-between gap-4">
          <dt className="text-ash">{r.label}</dt>
          <dd className="text-right">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const cardBox = "rounded-xl border border-rule bg-studio p-4";

function Card({
  card,
  busy,
  onSend,
  onDecide,
}: {
  card: AgentCard;
  busy: boolean;
  onSend: (text: string) => void;
  onDecide: (actionId: string, decision: "confirm" | "dismiss") => void;
}) {
  const t = useTranslations("agent.card");
  switch (card.kind) {
    case "services":
      return (
        <div className={cardBox} data-card="services">
          <ul className="divide-y divide-rule">
            {card.items.map((s) => (
              <li key={s.slug} className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{s.name}</p>
                  <p className="text-xs text-ash">{s.detail}</p>
                </div>
                <p className="num shrink-0 text-right text-sm">
                  {s.price} <span className="text-xs text-ash">{s.unit}</span>
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ash">{t("prices")}</p>
        </div>
      );
    case "quote":
      return (
        <div className={cardBox} data-card="quote">
          <p className="text-xs text-ash uppercase">{t("estimate")}</p>
          <p className="type-sub mt-1 text-xl first-letter:uppercase">{card.deliveryDate}</p>
          {card.requested && (
            <p className={`mt-1 text-sm ${card.requested.feasible ? "text-emerald-300" : "text-amber-200"}`}>
              {card.requested.feasible ? t("requestedYes", { date: card.requested.date }) : t("requestedNo", { date: card.requested.date })}
            </p>
          )}
          <Rows
            rows={[
              ...card.lines.map((l) => ({ label: `${l.name} × ${l.quantity}`, value: l.amount })),
              { label: t("total"), value: card.total },
              { label: t("deposit", { percent: card.depositPercent }), value: card.deposit },
              { label: t("balance"), value: card.balance },
              { label: t("starts"), value: card.startDate },
            ]}
          />
        </div>
      );
    case "slots":
      return (
        <div className={cardBox} data-card="slots">
          <p className="text-sm font-semibold first-letter:uppercase">
            {card.serviceName} · {card.dateLabel}
          </p>
          <p className="mt-0.5 text-xs text-ash">
            {t("pickSlot")} ({card.timeZone})
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {card.slots.map((s) => (
              <button
                key={s.iso}
                type="button"
                disabled={busy}
                onClick={() => onSend(t("slotMessage", { date: card.dateLabel, time: s.label }))}
                className="num min-h-10 rounded-full border border-rule-key px-3.5 text-sm hover:border-bone/60 hover:bg-bone/5 disabled:opacity-50"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      );
    case "proposal":
      return (
        <div className="rounded-xl border border-bone/40 bg-key p-4" data-card="proposal">
          <p className="type-sub text-lg">{card.title}</p>
          <Rows rows={[...card.rows, { label: t("total"), value: card.total }, { label: t("depositShort"), value: card.deposit }]} />
          {card.state === "open" ? (
            <>
              <p className="mt-3 text-xs text-bone/70">{t("reviewNote")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDecide(card.actionId, "confirm")}
                  className="min-h-11 rounded-full bg-bone px-5 text-sm font-semibold text-studio hover:bg-white disabled:opacity-50"
                >
                  {busy ? t("confirming") : t("confirm")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDecide(card.actionId, "dismiss")}
                  className="min-h-11 rounded-full border border-bone/40 px-5 text-sm hover:bg-bone/5 disabled:opacity-50"
                >
                  {t("cancel")}
                </button>
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-ash">
              {card.state === "confirmed" ? t("confirmed") : card.state === "dismissed" ? t("dismissed") : t("expired")}
            </p>
          )}
        </div>
      );
    case "booked":
      return (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4" data-card="booked">
          <p className="text-xs text-ash uppercase">{t("code")}</p>
          <p className="type-figure num mt-1 text-3xl">{card.code}</p>
          {card.holdUntil && <p className="mt-2 text-sm text-bone/80">{t("holdUntil", { time: card.holdUntil })}</p>}
          <a
            href={card.checkoutPath}
            className="mt-4 inline-flex min-h-11 items-center rounded-full bg-bone px-5 text-sm font-semibold text-studio hover:bg-white"
          >
            {t("pay", { amount: card.deposit })}
          </a>
        </div>
      );
    case "status":
      return (
        <div className={cardBox} data-card="status">
          <p className="text-xs text-ash uppercase">{card.code}</p>
          <p className="type-sub mt-1 text-lg">{card.status}</p>
          <Rows rows={card.rows} />
          <a href={card.checkoutPath} className="mt-3 inline-flex min-h-10 items-center text-sm underline underline-offset-4 hover:text-white">
            {t("viewBooking")}
          </a>
        </div>
      );
    case "contact":
      return (
        <div className="flex flex-wrap gap-2" data-card="contact">
          {card.email && (
            <a href={`mailto:${card.email}`} className="min-h-10 rounded-full border border-rule-key px-4 py-2 text-sm hover:bg-bone/5">
              {t("emailUs")} · {card.email}
            </a>
          )}
          {card.instagram && (
            <a href={card.instagram} target="_blank" rel="noopener noreferrer" className="min-h-10 rounded-full border border-rule-key px-4 py-2 text-sm hover:bg-bone/5">
              {t("instagram")}
            </a>
          )}
          {card.whatsapp && (
            <a
              href={`https://wa.me/${card.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-10 rounded-full border border-rule-key px-4 py-2 text-sm hover:bg-bone/5"
            >
              {t("whatsapp")}
            </a>
          )}
        </div>
      );
  }
}
