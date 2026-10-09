/**
 * INITIAL DATA ONLY — read by prisma/seed.ts to fill an empty database.
 * At runtime the app reads services from the database, and you edit them in
 * /dashboard/services. Changing this file does not change the live site.
 *
 * Prices are in cents (15000 = $150.00 USD).
 */
import type { BookingMode, PricingUnit } from "../src/server/domain/types";

export interface ServiceSeed {
  slug: string;
  nameEs: string;
  nameEn: string;
  descriptionEs: string;
  descriptionEn: string;
  includesEs: string[];
  includesEn: string[];
  promiseEs: string;
  promiseEn: string;
  guideStages: string[];
  priceCents: number;
  pricingUnit: PricingUnit;
  bookingMode: BookingMode;
  turnaroundDays: number | null;
  sessionMinutes: number | null;
  revisionsIncluded: number;
  sortOrder: number;
}

export const serviceSeeds: ServiceSeed[] = [
  {
    slug: "mezcla-mastering",
    nameEs: "Mezcla + Mastering",
    nameEn: "Mixing + Mastering",
    descriptionEs: "Tu canción mezclada y masterizada, lista para distribuir.",
    descriptionEn: "Your song mixed and mastered, ready for distribution.",
    includesEs: [
      "Mezcla",
      "Mastering",
      "Afinación vocal",
      "Alineación vocal",
      "Efectos creativos",
      "Procesamiento profesional de voces",
      "Balance instrumental",
      "Master final listo para distribución",
    ],
    includesEn: [
      "Mixing",
      "Mastering",
      "Vocal tuning",
      "Vocal alignment",
      "Creative effects",
      "Professional vocal processing",
      "Instrumental balance",
      "Final master ready for distribution",
    ],
    promiseEs: "Tu canción con el peso, la claridad y el brillo de un gran lanzamiento.",
    promiseEn: "Your song with the weight, clarity and shine of a major release.",
    guideStages: ["recorded"],
    priceCents: 15000,
    pricingUnit: "PER_SONG",
    bookingMode: "DELIVERY",
    turnaroundDays: 4,
    sessionMinutes: null,
    revisionsIncluded: 2,
    sortOrder: 10,
  },
  {
    slug: "mastering",
    nameEs: "Mastering",
    nameEn: "Mastering",
    descriptionEs: "Master final de una canción ya mezclada.",
    descriptionEn: "Final master of an already mixed song.",
    includesEs: [],
    includesEn: [],
    promiseEs: "El toque final: volumen, brillo y consistencia en todas las plataformas.",
    promiseEn: "The final touch: loudness, shine and consistency on every platform.",
    guideStages: ["mixed"],
    priceCents: 7000,
    pricingUnit: "PER_SONG",
    bookingMode: "DELIVERY",
    turnaroundDays: 4, // confirmed: 4 days leaves buffer even though it can be done in 1
    sessionMinutes: null,
    revisionsIncluded: 2,
    sortOrder: 20,
  },
  {
    slug: "creacion-de-pista",
    nameEs: "Creación de pista",
    nameEn: "Beat / Instrumental",
    descriptionEs: "Instrumental original creado a la medida de tu canción.",
    descriptionEn: "An original instrumental built for your song.",
    includesEs: [],
    includesEn: [],
    promiseEs: "Un instrumental original, hecho a la medida de tu voz y tu historia.",
    promiseEn: "An original instrumental, made to fit your voice and your story.",
    guideStages: ["other"],
    priceCents: 15000,
    pricingUnit: "PER_SONG",
    bookingMode: "DELIVERY",
    turnaroundDays: 4,
    sessionMinutes: null,
    revisionsIncluded: 2,
    sortOrder: 30,
  },
  {
    slug: "produccion-completa",
    nameEs: "Producción completa",
    nameEn: "Full production",
    descriptionEs: "De la idea al master: pista, mezcla y mastering.",
    descriptionEn: "From idea to master: beat, mixing and mastering.",
    includesEs: [],
    includesEn: [],
    promiseEs: "De la idea al disco: me encargo de todo para que solo pienses en cantar.",
    promiseEn: "From idea to record: I handle everything so you can focus on singing.",
    guideStages: ["idea"],
    priceCents: 27000,
    pricingUnit: "PER_SONG",
    bookingMode: "DELIVERY",
    turnaroundDays: 8, // pista (4) + mezcla y mastering (4)
    sessionMinutes: null,
    revisionsIncluded: 2,
    sortOrder: 40,
  },
  {
    slug: "arreglos-musicales",
    nameEs: "Arreglos musicales",
    nameEn: "Music arrangements",
    descriptionEs: "Arreglos para llevar tu canción a otro nivel.",
    descriptionEn: "Arrangements that take your song further.",
    includesEs: [],
    includesEn: [],
    promiseEs: "Instrumentos, armonías y detalles que llevan tu canción a otro nivel.",
    promiseEn: "Instruments, harmonies and details that take your song to another level.",
    guideStages: ["other"],
    priceCents: 8000,
    pricingUnit: "PER_SONG",
    bookingMode: "DELIVERY",
    turnaroundDays: 4,
    sessionMinutes: null,
    revisionsIncluded: 2,
    sortOrder: 50,
  },
  {
    slug: "arreglos-dj",
    nameEs: "Arreglos para DJ",
    nameEn: "DJ edits",
    descriptionEs: "Versiones y edits pensados para la cabina.",
    descriptionEn: "Versions and edits built for the booth.",
    includesEs: [],
    includesEn: [],
    promiseEs: "Versiones y edits que prenden la pista desde el primer segundo.",
    promiseEn: "Versions and edits that light up the floor from the first second.",
    guideStages: ["other"],
    priceCents: 5000,
    pricingUnit: "PER_SONG",
    bookingMode: "DELIVERY",
    turnaroundDays: 4,
    sessionMinutes: null,
    revisionsIncluded: 2,
    sortOrder: 60,
  },
  {
    slug: "publicidad-audio",
    nameEs: "Publicidad / Ads",
    nameEn: "Audio ads",
    descriptionEs: "Anuncios de audio por encargo para radio y redes sociales.",
    descriptionEn: "Commissioned audio ads for radio and social media.",
    includesEs: [],
    includesEn: [],
    promiseEs: "Anuncios que suenan grande y se quedan en la cabeza.",
    promiseEn: "Ads that sound big and stick in people's heads.",
    guideStages: ["other"],
    priceCents: 5000,
    pricingUnit: "FLAT",
    bookingMode: "DELIVERY",
    turnaroundDays: 4, // confirmed
    sessionMinutes: null,
    revisionsIncluded: 2,
    sortOrder: 70,
  },
  {
    slug: "grabacion-voces",
    nameEs: "Grabación de voces",
    nameEn: "Vocal recording session",
    descriptionEs: "Sesión remota por videollamada, por hora.",
    descriptionEn: "Remote session over video call, per hour.",
    includesEs: [],
    includesEn: [],
    promiseEs: "Te dirijo en la sesión para sacar tu mejor toma, estés donde estés.",
    promiseEn: "I direct your session to get your best take, wherever you are.",
    guideStages: ["vocals"],
    priceCents: 2500,
    pricingUnit: "PER_HOUR",
    bookingMode: "SESSION",
    turnaroundDays: null,
    sessionMinutes: 60,
    revisionsIncluded: 0,
    sortOrder: 80,
  },
  {
    slug: "asesoria-productores",
    nameEs: "Asesoría para productores",
    nameEn: "Producer coaching",
    descriptionEs: "Sesión 1 a 1 por videollamada, por hora.",
    descriptionEn: "1-on-1 session over video call, per hour.",
    includesEs: [],
    includesEn: [],
    promiseEs: "Más de 13 años de oficio en una sesión 1 a 1 para llevar tus mezclas más lejos.",
    promiseEn: "13+ years of craft in a 1-on-1 session to take your mixes further.",
    guideStages: ["other"],
    priceCents: 5000,
    pricingUnit: "PER_HOUR",
    bookingMode: "SESSION",
    turnaroundDays: null,
    sessionMinutes: 60,
    revisionsIncluded: 0,
    sortOrder: 90,
  },
];
