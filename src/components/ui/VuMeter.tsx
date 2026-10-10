import type { CSSProperties } from "react";

/**
 * A consola-style level meter under a figure: segments light up one after
 * another when the figure comes into view (the parent's .is-in), with the top
 * lit segment in brass as the peak. Purely decorative.
 */
export function VuMeter({ level, segments = 18, className = "" }: { level: number; segments?: number; className?: string }) {
  const lit = Math.max(1, Math.min(segments, Math.round(level * segments)));
  return (
    <span aria-hidden className={`vu-meter mt-3 flex h-1.5 w-full max-w-[13rem] gap-[3px] ${className}`}>
      {Array.from({ length: segments }, (_, i) => (
        <span
          key={i}
          className={`vu-seg h-full flex-1 rounded-[1px] ${i < lit - 1 ? "vu-on" : i === lit - 1 ? "vu-peak" : ""}`}
          style={{ "--i": i } as CSSProperties}
        />
      ))}
    </span>
  );
}
