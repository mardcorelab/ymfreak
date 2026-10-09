"use client";

import { useEffect, useState } from "react";

type Channel = { ok: true; channelId: string; videos: number; shorts: number } | { ok: false; reason: string };
type Views =
  | { ok: true; data: { total: number; releases: { slug: string; title: string; views: number; videos: number }[]; at: string } }
  | { ok: false; reason: string };

function Row({ state, label, detail, children }: { state: "ok" | "warn" | "wait"; label: string; detail: string; children?: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-rule px-4 py-3">
      <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${state === "ok" ? "bg-emerald-400" : state === "warn" ? "bg-amber-400" : "bg-ash"}`} />
      <span className="min-w-0">
        <span className="font-medium">{label}</span> <span className="text-ash">· {detail}</span>
        {children}
      </span>
    </li>
  );
}

/** Checks YouTube after the dashboard has loaded: channel feed and view counts. */
export function YoutubeStatusRow() {
  const [s, setS] = useState<{ channel: Channel; views: Views } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/admin/youtube-status", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ channel: Channel; views: Views }>)
      .then((v) => alive && setS(v))
      .catch(() => alive && setS({ channel: { ok: false, reason: "No se pudo comprobar." }, views: { ok: false, reason: "No se pudo comprobar." } }));
    return () => {
      alive = false;
    };
  }, []);
  const fmt = new Intl.NumberFormat("es-DO");
  if (!s) {
    return (
      <>
        <Row state="wait" label="YouTube (videos del canal)" detail="Comprobando…" />
        <Row state="wait" label="YouTube (reproducciones)" detail="Comprobando…" />
      </>
    );
  }
  const c = s.channel;
  const v = s.views;
  return (
    <>
      <Row
        state={c.ok ? "ok" : "warn"}
        label="YouTube (videos del canal)"
        detail={c.ok ? `Canal ${c.channelId}: ${c.videos} videos${c.shorts ? ` y ${c.shorts} shorts` : ""} recientes${c.videos === 0 ? " (la sección de la web aparece cuando subas un video)" : ""}` : c.reason}
      />
      <Row
        state={v.ok ? "ok" : "warn"}
        label="YouTube (reproducciones)"
        detail={
          v.ok
            ? v.data.releases.length
              ? `${fmt.format(v.data.total)} en total, se muestran en la web y se actualizan cada hora`
              : "Conectado. Añade el enlace de YouTube de tus trabajos (Trabajos → el trabajo → Página del lanzamiento) para sumar sus reproducciones."
            : v.reason
        }
      >
        {v.ok && v.data.releases.length > 0 && (
          <ul className="mt-2 grid gap-1 text-xs text-ash">
            {v.data.releases.map((r) => (
              <li key={r.slug}>
                {r.title}: {fmt.format(r.views)} ({r.videos} {r.videos === 1 ? "video" : "videos"})
              </li>
            ))}
          </ul>
        )}
      </Row>
    </>
  );
}
