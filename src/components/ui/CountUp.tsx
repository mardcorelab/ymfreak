"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Shows the final number from the start (no JavaScript, thumbnails, screen
 * readers), then counts up from zero once it scrolls into view.
 */
export function CountUp({ value, locale, className }: { value: number; locale: "es" | "en"; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  const fmt = new Intl.NumberFormat(locale === "es" ? "es-DO" : "en-US");

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) return; // already on screen: leave it
    setShown(0);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const duration = 1600;
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / duration);
          setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value]);

  return (
    <span ref={ref} className={className} aria-label={fmt.format(value)}>
      <span aria-hidden>{fmt.format(shown)}</span>
    </span>
  );
}
