"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

let referrerSent = false;

/** Sends one cookie-free event. Honours Do Not Track / Global Privacy Control. The external referrer is sent once per visit. */
export function track(type: "pageview" | "agent_open" | "click", path = window.location.pathname, label?: string) {
  try {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (nav.globalPrivacyControl || nav.doNotTrack === "1") return;
    const params = new URLSearchParams(window.location.search);
    const r = !referrerSent && type === "pageview" ? document.referrer || undefined : undefined;
    referrerSent = true;
    const payload = JSON.stringify({ t: type, p: path, l: label, r, u: params.get("utm_source") || undefined });
    if (!navigator.sendBeacon?.("/api/t", new Blob([payload], { type: "text/plain" }))) {
      void fetch("/api/t", { method: "POST", body: payload, keepalive: true });
    }
  } catch {
    /* never break the page */
  }
}

export function Analytics() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!pathname || last.current === pathname) return;
    last.current = pathname;
    track("pageview", pathname);
  }, [pathname]);
  return null;
}
