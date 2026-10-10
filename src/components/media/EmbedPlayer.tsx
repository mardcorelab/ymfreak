"use client";

import Image from "next/image";
import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import type { PortfolioVM } from "@/lib/view-models";
import { embedUrl } from "@/lib/embed";

export interface EmbedPlayerLabels {
  play: string;
  loading: string;
  playerTitle: string;
  coverAlt: string;
}

/**
 * Shows the cover with a play button. The Spotify/YouTube player — and its
 * scripts and cookies — loads only when the visitor presses play, which keeps
 * the page fast and private until then.
 */
export function EmbedPlayer({ item, labels }: { item: PortfolioVM; labels: EmbedPlayerLabels }) {
  const [active, setActive] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [halo, setHalo] = useState<string | null>(null);
  const tiltRef = useRef<HTMLDivElement>(null);

  // The cover leans toward the pointer (mouse only, and only if motion is welcome).
  const onTilt = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = tiltRef.current;
    if (!el || e.pointerType !== "mouse" || !document.documentElement.classList.contains("motion")) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--ry", `${((x - 0.5) * 9).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${((0.5 - y) * 9).toFixed(2)}deg`);
    el.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
    el.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
    el.classList.add("is-tilting");
  };
  const endTilt = () => {
    const el = tiltRef.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.classList.remove("is-tilting");
  };
  // A soft halo in the cover's own colour (covers are served from this site, so they can be sampled).
  const sampleHalo = (img: HTMLImageElement) => {
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 8;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 8, 8);
      const d = ctx.getImageData(0, 0, 8, 8).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i] ?? 0;
        g += d[i + 1] ?? 0;
        b += d[i + 2] ?? 0;
        n++;
      }
      setHalo(`rgb(${Math.round(r / n)} ${Math.round(g / n)} ${Math.round(b / n)})`);
    } catch {
      /* cross-origin or unavailable: no halo */
    }
  };
  const src = item.embed ? embedUrl(item.embed) : null;
  const tall = item.embed?.provider === "SPOTIFY";

  if (active && src && item.embed) {
    return (
      <div className={`relative overflow-hidden rounded-md bg-studio-deep ${tall ? "h-[352px]" : "aspect-video"}`}>
        {!loaded && (
          <p role="status" className="absolute inset-0 grid place-items-center text-sm text-ash">
            {labels.loading}
          </p>
        )}
        <iframe
          src={src}
          title={labels.playerTitle}
          onLoad={() => setLoaded(true)}
          className="relative h-full w-full"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  return (
    <div className="group relative isolate aspect-square" onPointerMove={onTilt} onPointerLeave={endTilt}>
      {halo && <div aria-hidden className="cover-halo absolute inset-[10%] -z-10 rounded-full" style={{ "--halo": halo } as CSSProperties} />}
      <div ref={tiltRef} className="cover-tilt relative h-full overflow-hidden rounded-md bg-studio-deep">
      {item.coverUrl && (
        <div className="absolute inset-0" data-reveal="fader">
          <Image
            src={item.coverUrl}
            alt={labels.coverAlt}
            fill
            sizes="(min-width: 1024px) 40vw, 100vw"
            onLoad={(e) => sampleHalo(e.currentTarget)}
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
          />
        </div>
      )}
      <div aria-hidden className="cover-glare pointer-events-none absolute inset-0 z-10" />
      {src && (
        <button
          type="button"
          onClick={() => setActive(true)}
          aria-label={labels.play}
          className="absolute inset-0 flex items-end justify-start bg-gradient-to-t from-black/55 via-transparent to-transparent p-5"
        >
          <span className="grid size-16 place-items-center rounded-full bg-bone text-studio shadow-xl shadow-black/40 transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="ml-1 size-6" fill="currentColor">
              <path d="M7 4.5v15l13-7.5z" />
            </svg>
          </span>
        </button>
      )}
      </div>
    </div>
  );
}
