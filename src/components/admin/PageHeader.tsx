import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: string;
  description?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {back && (
          <Link href={back.href} className="text-sm text-ash hover:text-bone">
            ← {back.label}
          </Link>
        )}
        <h1 className="type-head mt-1 text-4xl sm:text-5xl">{title}</h1>
        {description && <p className="mt-2 max-w-[62ch] text-ash">{description}</p>}
      </div>
      {actions}
    </header>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return <p role="status" className="mb-6 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm">{children}</p>;
}

export function NewLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center rounded-full bg-bone px-5 text-sm font-semibold text-studio hover:bg-white">
      {label}
    </Link>
  );
}
