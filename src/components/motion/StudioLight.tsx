"use client";

import { useEffect, useRef } from "react";

/**
 * A soft studio light over the hero that follows the pointer, easing behind
 * it like a stage light. On touch screens it drifts slowly on its own (CSS).
 */
export function StudioLight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches) return;
    const host = el.parentElement;
    if (!host) return;
    let tx = 70, ty = 35, x = 70, y = 35, raf = 0, visible = true;

    const tick = () => {
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      el.style.setProperty("--lx", `${x.toFixed(2)}%`);
      el.style.setProperty("--ly", `${y.toFixed(2)}%`);
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.05 ? requestAnimationFrame(tick) : 0;
    };
    const onMove = (e: PointerEvent) => {
      if (!visible) return;
      const r = host.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width) * 100;
      ty = ((e.clientY - r.top) / r.height) * 100;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => (visible = Boolean(e?.isIntersecting)));
    io.observe(host);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return <div ref={ref} aria-hidden className="studio-light pointer-events-none absolute inset-0 -z-[5]" />;
}
