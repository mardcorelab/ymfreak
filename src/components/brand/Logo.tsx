import { MONOGRAM, SLOGAN, WORDMARK } from "./marks";

export const SLOGAN_TEXT = "El Producto Perfecto";

type Props = { className?: string; title?: string };

/**
 * Full "YM FREAK" logo. Decorative unless a title is given. With `shine`, a
 * band of light crosses it once (the hero), like light on brushed metal.
 */
export function Wordmark({ className = "", title, shine = false }: Props & { shine?: boolean }) {
  return (
    <svg viewBox={WORDMARK.viewBox} className={className} fill="currentColor" {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true })}>
      <path fillRule="evenodd" d={WORDMARK.d} />
      {shine && (
        <>
          <defs>
            <clipPath id="wordmark-shine-clip">
              <path fillRule="evenodd" d={WORDMARK.d} />
            </clipPath>
            <linearGradient id="wordmark-shine-band" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#fff" stopOpacity="0.95" />
              <stop offset="1" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g clipPath="url(#wordmark-shine-clip)">
            <rect className="logo-sweep" x="0" y="-60" width="420" height="440" fill="url(#wordmark-shine-band)" />
          </g>
        </>
      )}
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
