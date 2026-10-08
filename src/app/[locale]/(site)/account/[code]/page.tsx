import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { currentClient } from "@/server/portal/session";
import { getClientProject } from "@/server/portal/data";
import { FilesForm, ReviewForm, RevisionForm } from "@/components/portal/PortalForms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

type Props = { params: Promise<{ locale: AppLocale; code: string }> };

export default async function ProjectPage({ params }: Props) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  const client = await currentClient();
  if (!client) redirect(`/${locale}/account`);
  const project = await getClientProject(client.id, decodeURIComponent(code).toUpperCase(), locale);
  if (!project) notFound();
  const [t, tc] = await Promise.all([getTranslations("account"), getTranslations("checkout")]);
  const p = project;

  return (
    <section className="mx-auto max-w-3xl px-5 pb-24 pt-36 sm:px-8 lg:pt-44">
      <Link href="/account" className="text-sm text-ash hover:text-bone">
        ← {t("back")}
      </Link>
      <p className="num mt-6 text-sm text-ash">{p.code}</p>
      <h1 className="type-head mt-1 text-[clamp(2.6rem,6vw,4rem)]">{p.title}</h1>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="inline-flex rounded-full border border-rule px-4 py-2 text-sm" data-status={p.status}>
          {tc(`status.${p.status}`)}
        </span>
      </div>

      {p.due && p.checkoutPath && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-key p-5">
          <p>
            <span className="text-bone/70">{t("dueNow", { amount: "" })}</span>
            <span className="type-head num text-3xl">{p.due.amount}</span>
          </p>
          <a href={p.checkoutPath} className="inline-flex min-h-12 items-center rounded-full bg-bone px-6 font-semibold text-studio hover:bg-white">
            {t("payDue", { amount: p.due.amount })}
          </a>
        </div>
      )}

      <dl className="mt-8 grid gap-3 rounded-xl border border-rule p-5 sm:p-6">
        <Row label={t("services")} value={p.services} />
        <Row label={p.bookingMode === "DELIVERY" ? t("songs") : t("hours")} value={String(p.quantity)} />
        {p.when && <Row label={p.when.kind === "delivery" ? t("delivery") : t("session")} value={p.when.label} />}
        <div className="border-t border-rule" />
        <Row label={t("total")} value={p.total} strong />
        <Row label={t("paid")} value={p.paid} />
        {p.balanceOnDelivery && !["CANCELLED", "EXPIRED"].includes(p.status) && <Row label={t("balance")} value={p.balanceOnDelivery} />}
        {p.checkoutPath && (
          <a href={p.checkoutPath} className="mt-1 text-sm underline underline-offset-4 hover:text-white">
            {t("paymentPage")}
          </a>
        )}
      </dl>

      {/* Files exchanged on the project */}
      <section className="mt-12" aria-labelledby="files">
        <h2 id="files" className="type-sub text-2xl">
          {t("filesTitle")}
        </h2>
        {p.finalsLocked && (
          <p className="mt-4 rounded-lg border border-brass/40 bg-brass/10 px-4 py-3">
            {t("finalsLocked")}{" "}
            {p.checkoutPath && (
              <a href={p.checkoutPath} className="underline underline-offset-4">
                {t("pay")}
              </a>
            )}
          </p>
        )}
        {p.links.length === 0 ? (
          <p className="mt-3 text-ash">{t("noFiles")}</p>
        ) : (
          <ul className="mt-4 divide-y divide-rule border-y border-rule">
            {p.links.map((l) => (
              <li key={l.id} className="flex flex-wrap items-start justify-between gap-3 py-4" data-link-kind={l.kind}>
                <div className="min-w-0">
                  <p className="text-sm text-ash">
                    {t(`kind.${l.kind}`)} · {l.date}
                  </p>
                  {l.label && <p className="mt-0.5 font-medium">{l.label}</p>}
                  {l.note && <p className="mt-1 whitespace-pre-wrap text-bone/85">{l.note}</p>}
                  {l.kind === "FINAL" && !l.url && <p className="mt-1 text-sm text-ash">{t("finalLockedItem")}</p>}
                </div>
                {l.url && (
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-bone/40 px-4 text-sm hover:bg-bone/5"
                  >
                    {t("openLink")}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {p.status === "REVISION" && (
        <p role="status" className="mt-12 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3">
          {t("ok.REVISION_REQUESTED")}
        </p>
      )}

      {p.canRequestRevision && (
        <section className="mt-12 rounded-xl border border-rule p-5 sm:p-6" aria-labelledby="revision">
          <h2 id="revision" className="type-sub text-2xl">
            {t("revisionTitle")}
          </h2>
          <p className="mt-2 text-bone/85">{t("revisionIntro")}</p>
          <p className="mt-2 text-sm text-ash">{t("revisionCount", { included: p.revisions.included, used: p.revisions.used, fee: p.revisions.fee })}</p>
          <RevisionForm code={p.code} locale={locale} />
        </section>
      )}

      {(p.review.canReview || p.review.sent) && (
        <section className="mt-12 rounded-xl border border-brass/40 p-5 sm:p-6" aria-labelledby="review">
          <h2 id="review" className="type-sub text-2xl">
            {t("reviewTitle")}
          </h2>
          {p.review.sent ? (
            <p role="status" className="mt-2 text-bone/85">{p.review.published ? t("reviewSent") : t("reviewThanks")}</p>
          ) : (
            <>
              <p className="mt-2 text-bone/85">{t("reviewIntro")}</p>
              <ReviewForm code={p.code} locale={locale} defaultName={p.review.defaultName} />
            </>
          )}
        </section>
      )}

      {p.canSendFiles && (
        <section className="mt-12" aria-labelledby="send">
          <h2 id="send" className="type-sub text-2xl">
            {t("sendFilesTitle")}
          </h2>
          <p className="mt-2 text-bone/85">{t("sendFilesIntro")}</p>
          <FilesForm code={p.code} locale={locale} />
          {p.filesHelp.length > 0 && (
            <details className="mt-6 rounded-lg border border-rule px-5 py-4">
              <summary className="cursor-pointer font-medium">{t("whatFiles")}</summary>
              <div className="mt-3 grid gap-4">
                {p.filesHelp.map((f) => (
                  <div key={f.question}>
                    <p className="font-medium">{f.question}</p>
                    <p className="mt-1 whitespace-pre-wrap text-bone/85">{f.answer}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>
      )}

      {p.cancel && (
        <section className="mt-12 rounded-xl border border-rule p-5 sm:p-6">
          <h2 className="type-sub text-xl">{t("cancelTitle")}</h2>
          <p className="mt-2 text-bone/85">{t("cancelText", { deadline: p.cancel.deadline, amount: p.cancel.amount })}</p>
          {p.checkoutPath && (
            <a href={p.checkoutPath} className="mt-3 inline-block text-sm underline underline-offset-4">
              {t("paymentPage")}
            </a>
          )}
        </section>
      )}

      {p.timeline.length > 0 && (
        <section className="mt-12" aria-labelledby="timeline">
          <h2 id="timeline" className="type-sub text-2xl">
            {t("timeline")}
          </h2>
          <ol className="mt-4 grid gap-2">
            {p.timeline.map((e, i) => (
              <li key={i} className="flex gap-4 text-sm">
                <span className="num w-28 shrink-0 text-ash">{e.date}</span>
                <span>{tc(`status.${e.status}`)}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </section>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? "font-semibold" : "text-ash"}>{label}</dt>
      <dd className={`text-right first-letter:uppercase ${strong ? "type-head num text-2xl" : ""}`}>{value}</dd>
    </div>
  );
}
