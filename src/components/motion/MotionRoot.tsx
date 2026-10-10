"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { play, type UiSound } from "./sound";

/**
 * The site's motion engine (tiny on purpose):
 * - reveals [data-reveal] elements once as they enter the screen;
 * - shows a silver playhead along the top while a clicked page loads.
 * It only acts when html has .motion (set by MOTION_BOOT before the first
 * paint, and never for visitors who prefer reduced motion).
 */
export function MotionRoot({ studioOn, studioOff }: { studioOn: string; studioOff: string }) {
  const pathname = usePathname();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("motion-ready");
    if (!root.classList.contains("motion")) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    const watch = (scope: ParentNode) => scope.querySelectorAll("[data-reveal]:not(.is-in)").forEach((el) => io.observe(el));
    watch(document);
    // Content that appears later (client navigation, opened panels) is picked up too.
    const mo = new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => n instanceof Element && (n.matches("[data-reveal]") ? io.observe(n) : watch(n)));
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  // Navigation playhead: starts on an internal link click, ends when the new page is in.
  useEffect(() => {
    document.documentElement.classList.remove("navigating");
  }, [pathname]);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Interface sound (only if the visitor turned sound on).
      const control = (e.target as Element | null)?.closest?.("a, button, [data-sound]");
      if (control) play(((control as HTMLElement).dataset.sound as UiSound | undefined) ?? "tick");
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname || url.pathname.startsWith("/api/")) return;
      document.documentElement.classList.add("navigating");
      // Safety: never leave the page dimmed.
      window.setTimeout(() => document.documentElement.classList.remove("navigating"), 6000);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // A secret: typing "freak" anywhere (outside a text box) turns the studio lights down.
  useEffect(() => {
    let typed = "";
    let timer = 0;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.key.length !== 1) return;
      typed = (typed + e.key.toLowerCase()).slice(-5);
      if (typed !== "freak") return;
      typed = "";
      const on = document.documentElement.classList.toggle("studio-mode");
      play(on ? "kick" : "tick");
      setToast(on ? studioOn : studioOff);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setToast(null), 3200);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    };
  }, [studioOn, studioOff]);

  return (
    <>
      <div className="nav-playhead" aria-hidden />
      <div className="studio-mode-lights" aria-hidden>
        <span className="rec-lamp">REC</span>
      </div>
      {toast && (
        <p role="status" className="step-in fixed bottom-24 left-1/2 z-[75] -translate-x-1/2 rounded-full border border-rule-key bg-studio-deep/95 px-5 py-2.5 text-sm shadow-2xl shadow-black/50">
          {toast}
        </p>
      )}
    </>
  );
}

/**
 * Runs in <head> before the first paint: turns motion on unless the visitor
 * prefers reduced motion, and turns it off again if the app hasn't started
 * within 4 s (slow or failed script), so nothing stays hidden. On the first
 * home visit of a session it also plays the short intro (html.intro, pure
 * CSS, lifts by itself; skipped for automated browsers).
 */
export const MOTION_BOOT = `(function(){try{var d=document.documentElement;if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;d.classList.add('motion');setTimeout(function(){if(!d.classList.contains('motion-ready'))d.classList.remove('motion')},4000);if(/^\\/(es|en)\\/?$/.test(location.pathname)&&!navigator.webdriver){var k='ymf-intro';if(!sessionStorage.getItem(k)){sessionStorage.setItem(k,'1');d.classList.add('intro');setTimeout(function(){d.classList.remove('intro')},2600)}}}catch(e){}})();`;
