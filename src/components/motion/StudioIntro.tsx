"use client";

import { useEffect } from "react";

/**
 * First home visit of a session (decided before paint by MOTION_BOOT): a flat
 * silver waveform draws across a dark room, gives one kick, and the room opens
 * onto the page. Pure CSS, about 1.6 s; Escape or "Saltar" ends it at once.
 */
export function StudioIntro({ skipLabel }: { skipLabel: string }) {
  useEffect(() => {
    const end = () => document.documentElement.classList.remove("intro");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && end();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="studio-intro" aria-hidden>
      <div className="intro-curtain intro-curtain-top" />
      <div className="intro-curtain intro-curtain-bottom" />
      <svg className="intro-wave" viewBox="0 0 1000 120" preserveAspectRatio="none">
        <path
          className="intro-kick"
          d="M0 60 L440 60 C452 60 455 18 462 18 C470 18 472 102 480 102 C488 102 490 8 500 8 C510 8 512 112 520 112 C528 112 530 30 538 30 C545 30 548 60 560 60 L1000 60"
          fill="none"
          stroke="url(#intro-line)"
          strokeWidth="1.6"
          vectorEffect="non-scaling-stroke"
        />
        <defs>
          <linearGradient id="intro-line" x1="0" x2="1">
            <stop offset="0" stopColor="#ebe6dc" stopOpacity="0" />
            <stop offset="0.5" stopColor="#f4f1ea" />
            <stop offset="1" stopColor="#ebe6dc" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <button type="button" className="intro-skip" onClick={() => document.documentElement.classList.remove("intro")} tabIndex={-1}>
        {skipLabel}
      </button>
    </div>
  );
}
