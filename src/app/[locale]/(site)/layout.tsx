import { SiteShell } from "@/components/site/SiteShell";
import { ComingSoon } from "@/components/site/ComingSoon";
import { siteGate } from "@/server/site-visibility";

/** Every public page except the standalone link-in-bio page. Hidden behind "coming soon" when YM Freak turns that on. */
export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  if ((await siteGate()) === "coming-soon") return <ComingSoon locale={(await params).locale} />;
  return <SiteShell>{children}</SiteShell>;
}
