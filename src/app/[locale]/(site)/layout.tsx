import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { getContactVM } from "@/server/site-data";

/** Every public page except the standalone link-in-bio page. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const contact = await getContactVM();
  return (
    <>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter contact={contact} />
    </>
  );
}
