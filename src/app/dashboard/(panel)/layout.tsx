import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { MonogramTile, Wordmark } from "@/components/brand/Logo";
import { requireAdmin } from "@/server/auth/admin";
import { logoutAction } from "@/server/admin/actions/auth";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="mx-auto grid min-h-dvh max-w-7xl lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="border-b border-rule p-4 lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-6">
        <div className="mb-4 flex items-center justify-between lg:mb-8 lg:block">
          <Link href="/dashboard" className="flex items-center gap-3" aria-label="YM Freak — panel">
            <MonogramTile className="size-9" />
            <Wordmark className="h-[0.95rem] w-auto" />
          </Link>
          <p className="text-xs text-ash lg:mt-2">{admin.email}</p>
        </div>
        <AdminNav />
        <div className="mt-4 flex gap-4 text-sm lg:mt-8 lg:flex-col lg:gap-2">
          <a href="/es" target="_blank" rel="noopener noreferrer" className="text-ash hover:text-bone">
            Ver la web
          </a>
          <form action={logoutAction}>
            <button type="submit" className="text-ash hover:text-bone">
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>
      <main id="main" className="min-w-0 px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
        {children}
      </main>
    </div>
  );
}
