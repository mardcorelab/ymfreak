"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { track } from "@/components/site/Analytics";
import { Monogram } from "@/components/brand/Logo";
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

/** Opens the assistant from anywhere on the site: window.dispatchEvent(new Event("ymf:agent-open")). */
export const OPEN_EVENT = "ymf:agent-open";

export function AgentWidget() {
  const t = useTranslations("agent");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [userCount, setUserCount] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  // The link-in-bio page has its own button for the assistant.
  const hideLauncher = /^\/(es|en)\/links\/?$/.test(usePathname() ?? "");

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

  const say = useCallback((text: string) => setItems((prev) => [...prev, { type: "text", role: "assistant", text }]), []);

  const send = useCallback(
    async (raw: string) => {
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
          body: JSON.stringify({ conversationId, text, locale }),
        });
        const data = (await res.json()) as ChatResponse;
        if (data.conversationId) {
          setConversationId(data.conversationId);
          writeStored(data.conversationId);
        }
        if (data.ok) setItems((prev) => [...prev, ...data.items]);
        else say(t(`errors.${data.error}`));
      } catch {
        say(t("errors.network"));
      } finally {
        setBusy(false);
        inputRef.current?.focus();
      }
    },
    [busy, conversationId, locale, say, t],
  );

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
      {!open && !hideLauncher && (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => {
            setOpen(true);
            track("agent_open");
          }}
          className="fixed right-4 bottom-4 z-40 inline-flex min-h-12 items-center gap-2.5 rounded-full bg-bone py-2 pr-5 pl-3 font-semibold text-studio shadow-[0_8px_30px_rgba(0,0,0,0.45)] transition hover:bg-white active:scale-[0.98] sm:right-6 sm:bottom-6"
          aria-haspopup="dialog"
        >
          <span aria-hidden className="grid size-8 place-items-center rounded-full bg-black text-white">
            <Monogram className="w-[60%]" />
          </span>
          <span className="hidden sm:inline">{t("open")}</span>
          <span className="sm:hidden">{t("openShort")}</span>
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={t("title")}
          className="fixed inset-0 z-50 flex flex-col bg-studio-deep sm:inset-auto sm:right-6 sm:bottom-6 sm:h-[min(680px,calc(100dvh-3rem))] sm:w-[400px] sm:rounded-2xl sm:border sm:border-rule sm:shadow-[0_20px_60px_rgba(0,0,0,0.55)]"
        >
          <header className="flex items-center gap-3 border-b border-rule px-4 py-3">
            <span aria-hidden className="grid size-9 place-items-center rounded-full bg-black text-white ring-1 ring-rule-key">
              <Monogram className="w-[60%]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="type-sub text-lg leading-tight">{t("title")}</p>
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
            <Bubble role="assistant">{t("greeting")}</Bubble>
            {items.length === 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {(["s1", "s2", "s3"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => send(t(`suggestions.${k}`))}
                    className="min-h-10 rounded-full border border-rule-key px-3.5 text-left text-sm text-bone/90 hover:border-bone/60 hover:bg-bone/5"
                  >
                    {t(`suggestions.${k}`)}
                  </button>
                ))}
              </div>
            )}
            {items.map((item, i) =>
              item.type === "text" ? (
                <Bubble key={i} role={item.role}>
                  {item.text}
                </Bubble>
              ) : (
                <Card key={i} card={item.card} busy={busy} onSend={send} onDecide={decide} />
              ),
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
            ) : (
              <div className="flex items-end gap-2">
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
