"use client";

import { useEffect, useRef, useState } from "react";

export type TimelinePart = { id: string; label: string };

/**
 * The home page read like a song: a silver playhead advances as the visitor
 * scrolls, past markers named after the parts (Intro, Trabajos, Servicios…).
 * Desktop: a rail on the right edge, markers jump to their part.
 * Phone: a thin bar along the top.
 */
export function SongTimeline({ parts, label }: { parts: TimelinePart[]; label: string }) {
  const railRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [marks, setMarks] = useState<{ id: string; label: string; at: number }[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let raf = 0;
    let positions: { id: string; label: string; top: number; at: number }[] = [];

    const measure = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      positions = parts
        .map((p) => {
          const el = document.getElementById(p.id);
          if (!el) return null;
          const top = el.getBoundingClientRect().top + window.scrollY;
          return { ...p, top, at: Math.min(1, Math.max(0, top / max)) };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);
      setMarks(positions.map(({ id, label: l, at }) => ({ id, label: l, at })));
      update();
    };
    const update = () => {
      raf = 0;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const p = Math.min(1, Math.max(0, window.scrollY / max));
      railRef.current?.style.setProperty("--p", p.toFixed(4));
      barRef.current?.style.setProperty("--p", p.toFixed(4));
      setShown(window.scrollY > window.innerHeight * 0.45);
      const line = window.scrollY + window.innerHeight * 0.4;
      let current: string | null = positions[0]?.id ?? null;
      for (const pos of positions) if (pos.top <= line) current = pos.id;
      setActive(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(document.body);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [parts]);

  if (parts.length === 0) return null;

  return (
    <>
      {/* Phone: progress along the top edge */}
      <div
        ref={barRef}
        aria-hidden
        className={`fixed inset-x-0 top-0 z-40 h-[2px] origin-left bg-gradient-to-r from-bone/30 via-bone to-bone/70 transition-opacity duration-500 lg:hidden ${shown ? "opacity-100" : "opacity-0"}`}
        style={{ scale: "var(--p, 0) 1" }}
      />

      {/* Desktop: the rail */}
      <nav
        aria-label={label}
        data-testid="song-timeline"
        className={`group fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 transition-opacity duration-700 lg:block ${shown ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <div ref={railRef} className="relative h-[46vh] w-px bg-bone/15">
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 bg-gradient-to-b from-bone/20 via-bone/80 to-bone"
            style={{ height: "calc(var(--p, 0) * 100%)" }}
          />
          <div
            aria-hidden
            className="absolute left-1/2 size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-bone shadow-[0_0_10px_rgba(244,241,234,0.85)]"
            style={{ top: "calc(var(--p, 0) * 100%)" }}
          />
          <ol>
            {marks.map((m) => {
              const on = m.id === active;
              return (
                <li key={m.id} className="absolute right-0 -translate-y-1/2" style={{ top: `${m.at * 100}%` }}>
                  <a
                    href={`#${m.id}`}
                    aria-current={on ? "true" : undefined}
                    className="flex items-center gap-3 py-1.5 pl-6 text-right"
                  >
                    <span
                      className={`type-head whitespace-nowrap text-[0.58rem] uppercase tracking-[0.28em] transition-all duration-500 ${on ? "text-bone opacity-100" : "translate-x-1 text-ash opacity-0 group-hover:translate-x-0 group-hover:opacity-100"}`}
                    >
                      {m.label}
                    </span>
                    <span aria-hidden className={`block h-px transition-all duration-500 ${on ? "w-4 bg-bone" : "w-2.5 bg-bone/40"}`} />
                  </a>
                </li>
              );
            })}
          </ol>
        </div>
      </nav>
    </>
  );
}
