import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "YM Freak",
    short_name: "YM Freak",
    description: "Producer, mixing and mastering engineer.",
    start_url: "/es",
    display: "standalone",
    background_color: "#242424",
    theme_color: "#242424",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
