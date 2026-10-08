"use client";

import type { ComponentProps } from "react";
import { track } from "./Analytics";
import { OPEN_EVENT } from "@/components/agent/AgentWidget";

/** A plain link that records which button was clicked (cookie-free analytics). */
export function TrackedLink({ label, ...props }: ComponentProps<"a"> & { label: string }) {
  return (
    <a
      {...props}
      onClick={(e) => {
        track("click", window.location.pathname, label);
        props.onClick?.(e);
      }}
    />
  );
}

/** Opens the assistant chat. */
export function OpenAgentButton({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        track("click", window.location.pathname, "agent");
        window.dispatchEvent(new Event(OPEN_EVENT));
      }}
    >
      {children}
    </button>
  );
}
