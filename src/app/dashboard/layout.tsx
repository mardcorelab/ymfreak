import type { Metadata, Viewport } from "next";
import { archivo } from "@/lib/fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: "Panel — YM Freak", template: "%s — Panel YM Freak" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#1d1d1d", colorScheme: "dark" };

export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={archivo.variable}>
      <body className="min-h-dvh bg-studio-deep antialiased">{children}</body>
    </html>
  );
}
