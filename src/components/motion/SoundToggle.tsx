"use client";

import { useEffect, useState } from "react";
import { SOUND_EVENT, setSound, soundOn } from "./sound";

/** The switch for interface sounds (off unless the visitor turns it on). */
export function SoundToggle({ label, className = "" }: { label: string; className?: string }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(soundOn());
    const sync = (e: Event) => setOn(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener(SOUND_EVENT, sync);
    return () => window.removeEventListener(SOUND_EVENT, sync);
  }, []);

  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => setSound(!on)}
      className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm transition-colors ${on ? "text-bone" : "text-ash hover:text-bone"} ${className}`}
    >
      <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
        <path d="M3 8v4h3l4 3V5L6 8H3z" fill="currentColor" />
        {on ? (
          <path d="M13 7a4 4 0 010 6m2-8.5a7 7 0 010 11" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M13.5 8l4 4m0-4l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        )}
      </svg>
      {label}
    </button>
  );
}
