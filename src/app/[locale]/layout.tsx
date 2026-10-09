import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { agentAvailable } from "@/server/agent/model";
import { getAgentSettings } from "@/server/agent/settings";
import { AgentWidget } from "@/components/agent/AgentWidget";
import { Analytics } from "@/components/site/Analytics";
import { siteUrl } from "@/lib/seo";
import { archivo, michroma } from "@/lib/fonts";
import "../globals.css";


export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = { themeColor: "#242424", colorScheme: "dark" };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t("title"), template: "%s — YM Freak" },
    description: t("description"),
    applicationName: "YM Freak",
    openGraph: {
      type: "website",
      siteName: "YM Freak",
      locale: locale === "es" ? "es_DO" : "en_US",
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const agent = await getAgentSettings();

  return (
    <html lang={locale} className={`${archivo.variable} ${michroma.variable}`}>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>
          {children}
          {agentAvailable() && <AgentWidget name={agent.name} />}
          <Analytics />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
