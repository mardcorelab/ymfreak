import { Archivo } from "next/font/google";

// One family; its width axis does the typographic work (condensed for display).
export const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-archivo",
});
