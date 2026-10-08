"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { cancelMyBooking, payNow, type PayActionState } from "@/server/payments/actions";

function PayButton({ label, leaving }: { label: string; leaving: boolean }) {
  const { pending: submitting } = useFormStatus();
  // Disabled until the page is interactive: a click before that would submit without opening PayPal.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const pending = submitting || leaving;
  const t = useTranslations("checkout");
  return (
    <button
      type="submit"
      disabled={pending || !ready}
      className="inline-flex min-h-12 items-center rounded-full bg-bone px-8 font-semibold text-studio transition hover:bg-white disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? t("redirecting") : label}
    </button>
  );
}

function ErrorText({ state }: { state: PayActionState }) {
  const t = useTranslations("checkout");
  if (state.status !== "error") return null;
  return (
    <p role="alert" className="mt-4 rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm">
      {t.has(`errors.${state.error}`) ? t(`errors.${state.error}`) : t("errors.generic")}
    </p>
  );
}

/** Sends the client to PayPal for whatever is due on this order. */
export function PayForm({ orderId, locale, label, amount }: { orderId: string; locale: "es" | "en"; label: string; amount: string }) {
  const t = useTranslations("checkout");
  const [state, action, pending] = useActionState(payNow.bind(null, orderId, locale), { status: "idle" });
  // Full page navigation to PayPal (not a client-side route change).
  useEffect(() => {
    if (state.status === "redirect") window.location.assign(state.url);
  }, [state]);
  const leaving = pending || state.status === "redirect";
  return (
    <form action={action} className="rounded-lg bg-key p-6">
      <p className="text-sm text-bone/70">{t("amountNow")}</p>
      <p className="type-head num mt-1 text-5xl">{amount}</p>
      <div className="mt-5">
        <PayButton label={label} leaving={leaving} />
      </div>
      <p className="mt-3 text-sm text-bone/70">{t("payNote")}</p>
      <ErrorText state={state} />
    </form>
  );
}

/** Self-service cancellation with an explicit confirmation. */
export function CancelForm({ orderId, text }: { orderId: string; text: string }) {
  const t = useTranslations("checkout");
  const [state, action, pending] = useActionState(cancelMyBooking.bind(null, orderId), { status: "idle" });
  if (state.status === "ok") {
    return (
      <p role="status" className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3">
        {t("cancelDone")}
      </p>
    );
  }
  return (
    <form action={action} className="rounded-lg border border-rule p-6">
      <h2 className="type-sub text-xl">{t("cancelTitle")}</h2>
      <p className="mt-2 text-bone/80">{text}</p>
      <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3">
        <input type="checkbox" name="confirm" className="size-4 accent-[#ebe6dc]" />
        <span>{t("cancelConfirm")}</span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="mt-3 min-h-11 rounded-full border border-red-400/50 px-5 text-sm text-red-200 hover:bg-red-500/10 disabled:opacity-60"
      >
        {t("cancelButton")}
      </button>
      <ErrorText state={state} />
    </form>
  );
}
