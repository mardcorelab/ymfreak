import { SiteShell } from "@/components/site/SiteShell";

/**
 * Client portal, checkout and legal pages. They stay reachable even while the
 * public site is hidden: clients with bookings must still pay and follow them.
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
