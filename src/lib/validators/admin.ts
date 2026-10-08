/**
 * Validation for everything YM Freak edits in the dashboard. Messages are in
 * Spanish because the dashboard is.
 */
import { z } from "zod";

const t = (max: number, label: string) =>
  z.string().trim().min(1, `${label}: no puede estar vacío`).max(max, `${label}: máximo ${max} caracteres`);
const optional = (max: number, label: string) =>
  z.string().trim().max(max, `${label}: máximo ${max} caracteres`).nullable();
const httpsUrl = (label: string) =>
  z.string().url(`${label}: enlace no válido`).startsWith("https://", `${label}: debe empezar por https://`);
const int = (label: string, min: number, max: number) =>
  z
    .number({ invalid_type_error: `${label}: escribe un número entero`, required_error: `${label}: obligatorio` })
    .int(`${label}: escribe un número entero`)
    .min(min, `${label}: mínimo ${min}`)
    .max(max, `${label}: máximo ${max}`);
const choice = <T extends [string, ...string[]]>(values: T, label: string) =>
  z.enum(values, { errorMap: () => ({ message: `${label}: elige una opción` }) });
const order = z.number({ invalid_type_error: "Orden: debe ser un número entero" }).int("Orden: debe ser un número entero").min(0).max(9999);
const year = z
  .number({ invalid_type_error: "Año: debe ser un número" })
  .int("Año: debe ser un número entero")
  .min(1950, "Año: demasiado antiguo")
  .max(2100, "Año: no válido")
  .nullable();

export const serviceSchema = z
  .object({
    nameEs: t(80, "Nombre (ES)"),
    nameEn: t(80, "Nombre (EN)"),
    descriptionEs: t(300, "Descripción (ES)"),
    descriptionEn: t(300, "Descripción (EN)"),
    includesEs: z.array(z.string().max(120)).max(20, "Qué incluye: máximo 20 líneas"),
    includesEn: z.array(z.string().max(120)).max(20, "Qué incluye: máximo 20 líneas"),
    priceCents: z
      .number({ invalid_type_error: "Precio: escribe un monto válido, por ejemplo 150 o 75.50" })
      .refine((n) => Number.isInteger(n), "Precio: escribe un monto válido, por ejemplo 150 o 75.50")
      .refine((n) => n >= 100 && n <= 10_000_00, "Precio: debe estar entre $1 y $10,000"),
    pricingUnit: choice(["FLAT", "PER_SONG", "PER_HOUR"], "Unidad de precio"),
    bookingMode: choice(["DELIVERY", "SESSION"], "Tipo de servicio"),
    turnaroundDays: int("Días de entrega", 1, 60).nullable(),
    sessionMinutes: int("Duración de la sesión (min)", 15, 480).nullable(),
    revisionsIncluded: int("Revisiones incluidas", 0, 20),
    active: z.boolean(),
    sortOrder: order,
  })
  .refine((s) => s.includesEs.length === s.includesEn.length, {
    message: "Qué incluye: español e inglés deben tener el mismo número de líneas",
  })
  .refine((s) => s.bookingMode !== "DELIVERY" || s.turnaroundDays !== null, {
    message: "Días de entrega: obligatorio para servicios con entrega",
  })
  .refine((s) => s.bookingMode !== "SESSION" || s.sessionMinutes !== null, {
    message: "Duración de la sesión: obligatoria para sesiones",
  });

export const portfolioSchema = z.object({
  title: t(120, "Título"),
  artist: t(120, "Artista"),
  creditEs: optional(80, "Crédito (ES)"),
  creditEn: optional(80, "Crédito (EN)"),
  year,
  descriptionEs: optional(600, "Descripción (ES)"),
  descriptionEn: optional(600, "Descripción (EN)"),
  coverUrl: httpsUrl("Portada").nullable(),
  featured: z.boolean(),
  published: z.boolean(),
  sortOrder: order,
});

export const achievementSchema = z.object({
  kind: choice(["NOMINATION", "AWARD", "CERTIFICATION", "MILESTONE"], "Tipo"),
  titleEs: t(120, "Título (ES)"),
  titleEn: t(120, "Título (EN)"),
  detailEs: t(300, "Detalle (ES)"),
  detailEn: t(300, "Detalle (EN)"),
  year,
  highlight: z.boolean(),
  published: z.boolean(),
  portfolioId: z.string().max(40).nullable(),
  sortOrder: order,
});

export const testimonialSchema = z.object({
  author: t(80, "Nombre"),
  role: optional(80, "Rol"),
  quoteEs: t(600, "Testimonio (ES)"),
  quoteEn: t(600, "Testimonio (EN)"),
  published: z.boolean(),
  sortOrder: order,
});

export const knowledgeSchema = z.object({
  kind: choice(["FAQ", "POLICY", "PROCESS", "DOC"], "Tipo"),
  questionEs: t(200, "Pregunta (ES)"),
  questionEn: t(200, "Pregunta (EN)"),
  answerEs: t(2000, "Respuesta (ES)"),
  answerEn: t(2000, "Respuesta (EN)"),
  tags: z.array(z.string().max(40)).max(20),
  active: z.boolean(),
  sortOrder: order,
});

/** Turns Zod issues into plain sentences for the form. */
export function issuesToMessages(error: z.ZodError): string[] {
  return [...new Set(error.issues.map((i) => i.message))];
}
