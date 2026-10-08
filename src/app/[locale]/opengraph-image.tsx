import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { WORDMARK } from "@/components/brand/marks";
import { routing } from "@/i18n/routing";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "YM Freak";

// Rendered once per language at build time.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** Link preview (WhatsApp, Instagram, X, Google…): the logo over the studio portrait. */
export default async function OpenGraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // Read at build time (the image is prerendered per language).
  const photo = await readFile(join(process.cwd(), "public/images/ymfreak-portrait.jpg"));
  const photoSrc = `data:image/jpeg;base64,${photo.toString("base64")}`;
  const logo = `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${WORDMARK.viewBox}"><path fill="#ebe6dc" fill-rule="evenodd" d="${WORDMARK.d}"/></svg>`,
  )}`;
  const [, , w, h] = WORDMARK.viewBox.split(" ").map(Number) as [number, number, number, number];
  const logoWidth = 640;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#242424", position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoSrc} alt="" width={727} height={630} style={{ position: "absolute", right: 0, top: 0, objectFit: "cover" }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background: "linear-gradient(90deg, #242424 0%, #242424 38%, rgba(36,36,36,0.55) 62%, rgba(36,36,36,0) 85%)",
          }}
        />
        <div style={{ position: "absolute", left: 72, bottom: 84, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", color: "#a6a199", fontSize: 26, letterSpacing: 1 }}>
            {locale === "es" ? "Productor · Mezcla · Mastering" : "Producer · Mixing · Mastering"}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" width={logoWidth} height={Math.round((logoWidth * h) / w)} style={{ marginTop: 24 }} />
          <div style={{ display: "flex", color: "#c9a75f", fontSize: 24, marginTop: 30 }}>
            {locale === "es" ? "Nominado al Latin Grammy 2026" : "2026 Latin Grammy nominee"}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
