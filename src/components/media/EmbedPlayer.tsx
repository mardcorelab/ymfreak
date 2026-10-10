"use client";

import Image from "next/image";
import { useState } from "react";
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
    <div className="group relative aspect-square overflow-hidden rounded-md bg-studio-deep">
      {item.coverUrl && (
        <div className="absolute inset-0" data-reveal="fader">
          <Image
            src={item.coverUrl}
            alt={labels.coverAlt}
            fill
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
          />
        </div>
      )}
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
  );
}
