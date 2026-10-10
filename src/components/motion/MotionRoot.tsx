"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * The site's motion engine (tiny on purpose):
 * - reveals [data-reveal] elements once as they enter the screen;
 * - shows a silver playhead along the top while a clicked page loads.
 * It only acts when html has .motion (set by MOTION_BOOT before the first
 * paint, and never for visitors who prefer reduced motion).
 */
export function MotionRoot() {
  const pathname = usePathname();

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

  return <div className="nav-playhead" aria-hidden />;
}

/**
 * Runs in <head> before the first paint: turns motion on unless the visitor
 * prefers reduced motion, and turns it off again if the app hasn't started
 * within 4 s (slow or failed script), so nothing stays hidden.
 */
export const MOTION_BOOT = `(function(){try{var d=document.documentElement;if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;d.classList.add('motion');setTimeout(function(){if(!d.classList.contains('motion-ready'))d.classList.remove('motion')},4000)}catch(e){}})();`;
