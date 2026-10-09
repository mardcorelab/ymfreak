import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { getContactVM } from "@/server/site-data";

/** Header, main and footer shared by the public pages and the client portal. */
export async function SiteShell({ children }: { children: React.ReactNode }) {
  const contact = await getContactVM();
  return (
    <>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter contact={contact} />
    </>
  );
}
