"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { addClientFiles, requestRevision, signInWithCode, submitReview, type PortalState } from "@/server/portal/actions";

const idle: PortalState = { status: "idle" };
const input = "mt-2 w-full rounded-md border border-rule-key bg-studio-deep px-4 py-3 text-base text-bone placeholder:text-ash/60 focus:border-bone/60 focus:outline-none";
const button =
  "inline-flex min-h-12 items-center justify-center rounded-full bg-bone px-6 font-semibold text-studio transition hover:bg-white active:scale-[0.98] disabled:cursor-wait disabled:opacity-60";

function Feedback({ state }: { state: PortalState }) {
  const t = useTranslations("account");
  if (state.status === "error") {
    return (
      <p role="alert" className="mt-4 rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm">
        {t(`errors.${state.error}`)}
      </p>
    );
  }
  if (state.status === "ok" && state.code) {
    return (
      <p role="status" className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm">
        {t(`ok.${state.code}`)}
      </p>
    );
  }
  return null;
}

export function LoginForm({ locale }: { locale: string }) {
  const t = useTranslations("account");
  const [state, action, pending] = useActionState(signInWithCode, idle);
  return (
    <form action={action} className="mt-8 grid max-w-md gap-5">
      <input type="hidden" name="locale" value={locale} />
      <label className="block">
        <span className="text-sm text-bone/85">{t("email")}</span>
        <input name="email" type="email" required autoComplete="email" className={input} />
      </label>
      <label className="block">
        <span className="text-sm text-bone/85">{t("code")}</span>
        <input name="code" required autoComplete="off" autoCapitalize="characters" placeholder={t("codeHint")} className={`${input} num uppercase`} />
      </label>
      <div>
        <button type="submit" disabled={pending} className={button}>
          {pending ? t("signingIn") : t("signIn")}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function FilesForm({ code, locale }: { code: string; locale: string }) {
  const t = useTranslations("account");
  const [state, action, pending] = useActionState(addClientFiles, idle);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "ok") ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="mt-5 grid gap-4">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="locale" value={locale} />
      <label className="block">
        <span className="text-sm text-bone/85">{t("link")}</span>
        <input name="url" type="url" required inputMode="url" placeholder={t("linkHint")} className={input} />
      </label>
      <label className="block">
        <span className="text-sm text-bone/85">{t("note")}</span>
        <textarea name="note" rows={2} maxLength={1000} className={input} />
      </label>
      <div>
        <button type="submit" disabled={pending} className={button}>
          {pending ? t("sending") : t("sendLink")}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function RevisionForm({ code, locale }: { code: string; locale: string }) {
  const t = useTranslations("account");
  const [state, action, pending] = useActionState(requestRevision, idle);
  return (
    <form action={action} className="mt-5 grid gap-4">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="locale" value={locale} />
      <label className="block">
        <span className="text-sm text-bone/85">{t("revisionNote")}</span>
        <textarea name="note" rows={4} required minLength={5} maxLength={3000} className={input} />
      </label>
      <div>
        <button type="submit" disabled={pending} className={button}>
          {pending ? t("sending") : t("revisionSend")}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function ReviewForm({ code, locale, defaultName }: { code: string; locale: string; defaultName: string }) {
  const t = useTranslations("account");
  const [state, action, pending] = useActionState(submitReview, idle);
  const [rating, setRating] = useState(5);
  if (state.status === "ok") return <Feedback state={state} />;
  return (
    <form action={action} className="mt-5 grid gap-4">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="locale" value={locale} />
      <fieldset>
        <legend className="text-sm text-bone/85">{t("rating")}</legend>
        <div className="mt-2 flex gap-1" role="radiogroup">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer">
              <input
                type="radio"
                name="rating"
                value={n}
                checked={rating === n}
                onChange={() => setRating(n)}
                aria-label={t("ratingStar", { count: n })}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={`grid size-11 place-items-center rounded-full text-2xl transition peer-focus-visible:outline-2 peer-focus-visible:outline-bone ${n <= rating ? "text-brass" : "text-bone/25"}`}
              >
                ★
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="text-sm text-bone/85">{t("reviewText")}</span>
        <textarea name="text" rows={4} required minLength={20} maxLength={800} className={input} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm text-bone/85">{t("reviewName")}</span>
          <input name="name" required minLength={2} maxLength={80} defaultValue={defaultName} className={input} />
        </label>
        <label className="block">
          <span className="text-sm text-bone/85">{t("reviewRole")}</span>
          <input name="role" maxLength={80} placeholder={t("reviewRoleHint")} className={input} />
        </label>
      </div>
      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" name="consent" required className="mt-1 size-4 accent-[#ebe6dc]" />
        <span>{t("reviewConsent")}</span>
      </label>
      <div>
        <button type="submit" disabled={pending} className={button}>
          {pending ? t("sending") : t("reviewSend")}
        </button>
      </div>
      <Feedback state={state} />
    </form>
  );
}
