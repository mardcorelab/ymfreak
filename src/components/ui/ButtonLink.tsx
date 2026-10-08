import type { ComponentProps } from "react";
import { Link } from "@/i18n/navigation";

type Variant = "solid" | "line";

const base =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-[0.95rem] font-semibold " +
  "transition-[background-color,color,border-color,transform] duration-200 active:scale-[0.98]";

const variants: Record<Variant, string> = {
  solid: "bg-bone text-studio hover:bg-white",
  line: "border border-bone/40 text-bone hover:border-bone hover:bg-bone/5",
};

export function buttonClass(variant: Variant = "solid", extra = ""): string {
  return `${base} ${variants[variant]} ${extra}`.trim();
}

/** Internal navigation styled as a button. */
export function ButtonLink({
  variant = "solid",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

/** External link (mailto:, Instagram…) styled as a button. */
export function ButtonAnchor({
  variant = "solid",
  className = "",
  ...props
}: ComponentProps<"a"> & { variant?: Variant }) {
  const external = typeof props.href === "string" && props.href.startsWith("http");
  return (
    <a
      className={buttonClass(variant, className)}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...props}
    />
  );
}
