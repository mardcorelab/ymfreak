"use client";

/** Last-resort error screen (the root layout itself failed). Kept dependency-free. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, minHeight: "100vh", background: "#242424", color: "#ebe6dc", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center" }}>
        <main style={{ maxWidth: 480, padding: 24 }}>
          <h1 style={{ fontSize: 32, margin: 0 }}>Algo salió mal · Something went wrong</h1>
          <p style={{ opacity: 0.8 }}>Prueba de nuevo en un momento. · Please try again in a moment.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "12px 24px", borderRadius: 999, border: 0, background: "#ebe6dc", color: "#242424", fontWeight: 600 }}>
            Reintentar · Retry
          </button>
        </main>
      </body>
    </html>
  );
}
