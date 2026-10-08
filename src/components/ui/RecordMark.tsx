/** A record seen from above: the mark used next to certifications and nominations. */
export function RecordMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className} fill="none">
      <circle cx="16" cy="16" r="15" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="10.5" stroke="currentColor" strokeOpacity="0.45" />
      <circle cx="16" cy="16" r="7" stroke="currentColor" strokeOpacity="0.45" />
      <circle cx="16" cy="16" r="3.2" fill="currentColor" />
    </svg>
  );
}
