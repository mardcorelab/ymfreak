import { ImageResponse } from "next/og";
import { MONOGRAM } from "@/components/brand/marks";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: the YMF monogram on black (iOS rounds the corners itself). */
export default function AppleIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MONOGRAM.viewBox}"><path fill="#fff" fill-rule="evenodd" d="${MONOGRAM.d}"/></svg>`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} width={116} height={Math.round((116 * 345) / 395)} alt="" />
      </div>
    ),
    size,
  );
}
