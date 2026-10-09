import { Archivo, Michroma } from "next/font/google";

// Reading text: Archivo, whose width axis also gives condensed figures.
export const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-archivo",
});

// Titles: Michroma, wide and square like the "El Producto Perfecto" lettering.
export const michroma = Michroma({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-michroma",
});
