import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: the same waveform mark as the favicon. */
export default function AppleIcon() {
  const bars = [
    { h: 28, x: 34 },
    { h: 74, x: 58 },
    { h: 112, x: 83 },
    { h: 74, x: 108 },
    { h: 28, x: 132 },
  ];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", background: "#242424", display: "flex", position: "relative" }}>
        {bars.map((b) => (
          <div
            key={b.x}
            style={{ position: "absolute", left: b.x, top: 90 - b.h / 2, width: 14, height: b.h, borderRadius: 7, background: "#ebe6dc" }}
          />
        ))}
      </div>
    ),
    size,
  );
}
