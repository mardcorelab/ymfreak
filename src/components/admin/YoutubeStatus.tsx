"use client";

import { useEffect, useState } from "react";

type S = { ok: true; channelId: string; videos: number; shorts: number } | { ok: false; reason: string } | null;

/** Checks the YouTube connection after the dashboard has loaded. */
export function YoutubeStatusRow() {
  const [s, setS] = useState<S>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/admin/youtube-status", { cache: "no-store" })
      .then((r) => r.json() as Promise<S>)
      .then((v) => alive && setS(v))
      .catch(() => alive && setS({ ok: false, reason: "No se pudo comprobar." }));
    return () => {
      alive = false;
    };
  }, []);
  const ok = s?.ok === true;
  const detail = !s
    ? "Comprobando…"
    : s.ok
      ? `Canal ${s.channelId}: ${s.videos} videos${s.shorts ? ` y ${s.shorts} shorts` : ""} recientes${s.videos === 0 ? " (la sección de la web aparece cuando subas un video)" : ""}`
      : s.reason;
  return (
    <li className="flex items-start gap-3 rounded-lg border border-rule px-4 py-3">
      <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${ok ? "bg-emerald-400" : s ? "bg-amber-400" : "bg-ash"}`} />
      <span>
        <span className="font-medium">YouTube</span> <span className="text-ash">· {detail}</span>
      </span>
    </li>
  );
}
