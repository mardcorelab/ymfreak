"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

/** Links to the same page in the other language. */
export function LocaleSwitch({ label }: { label: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const other = locale === "es" ? "en" : "es";

  return (
    <Link href={pathname} locale={other} hrefLang={other} className="text-sm text-ash transition-colors hover:text-bone">
      {label}
    </Link>
  );
}
