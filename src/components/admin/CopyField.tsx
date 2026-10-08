"use client";

import { useState } from "react";

/** Read-only value with a copy button. */
export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="text-xs text-ash">{label}</p>
      <div className="mt-1 flex gap-2">
        <input readOnly value={value} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-md border border-rule bg-studio-deep px-3 py-2 text-sm" />
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* clipboard blocked: the field can still be selected */
            }
          }}
          className="min-h-10 shrink-0 rounded-full border border-rule px-4 text-sm hover:border-bone/40"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
