import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { getContactVM } from "@/server/site-data";
import { agentAvailable } from "@/server/agent/model";
import { AgentWidget } from "@/components/agent/AgentWidget";
import { siteUrl } from "@/lib/seo";
import { archivo } from "@/lib/fonts";
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
      images: [{ url: "/images/ymfreak-portrait.jpg", width: 1468, height: 1274, alt: "YM Freak" }],
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
  const contact = await getContactVM();

  return (
    <html lang={locale} className={archivo.variable}>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>
          <SiteHeader />
          <main id="main">{children}</main>
          <SiteFooter contact={contact} />
          {agentAvailable() && <AgentWidget />}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
