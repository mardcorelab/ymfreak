import { MONOGRAM, SLOGAN, WORDMARK } from "./marks";

export const SLOGAN_TEXT = "El Producto Perfecto";

type Props = { className?: string; title?: string };

/** Full "YM FREAK" logo. Decorative unless a title is given. */
export function Wordmark({ className = "", title }: Props) {
  return (
    <svg viewBox={WORDMARK.viewBox} className={className} fill="currentColor" {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}>
      <path fillRule="evenodd" d={WORDMARK.d} />
    </svg>
  );
}

/** Short "YMF" mark. Decorative unless a title is given. */
export function Monogram({ className = "", title }: Props) {
  return (
    <svg viewBox={MONOGRAM.viewBox} className={className} fill="currentColor" {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}>
      <path fillRule="evenodd" d={MONOGRAM.d} />
    </svg>
  );
}

/** Monogram on its black rounded tile, as in the official app icon. */
export function MonogramTile({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-grid place-items-center rounded-[22%] bg-black text-white ${className}`} aria-hidden>
      <Monogram className="w-[66%]" />
    </span>
  );
}

/** The slogan "El Producto Perfecto" in its own lettering. Readable by screen readers and search engines. */
export function Slogan({ className = "", decorative = false }: { className?: string; decorative?: boolean }) {
  return (
    <svg
      viewBox={SLOGAN.viewBox}
      className={className}
      fill="currentColor"
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": SLOGAN_TEXT })}
    >
      <path fillRule="evenodd" d={SLOGAN.d} />
    </svg>
  );
}
