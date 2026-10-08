/**
 * Input validation for booking requests. Used by the /book form, the server
 * action behind it and the assistant's propose_booking tool, so the three can
 * never disagree. Note there is no price field: prices are resolved server-side.
 */
import { z } from "zod";

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60);
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const plainText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    // Strip control characters; rendering escapes HTML, this keeps logs and emails clean.
    .transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ""));

export const projectDetailsSchema = z.object({
  songTitle: plainText(120).pipe(z.string().min(1)),
  artistName: plainText(120).pipe(z.string().min(1)),
  referenceLinks: z.array(z.string().url().startsWith("https://").max(500)).max(5).default([]),
  notes: plainText(2000).default(""),
});

export const customerContactSchema = z.object({
  name: plainText(100).pipe(z.string().min(2)),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/)
    .optional(),
  country: z.string().length(2).toUpperCase().optional(),
  locale: z.enum(["es", "en"]),
});

export const deliveryBookingRequestSchema = z.object({
  mode: z.literal("DELIVERY"),
  services: z.array(slug).min(1).max(4),
  songs: z.number().int().min(1).max(20),
  requestedDeliveryDate: localDate.optional(),
  project: projectDetailsSchema,
  customer: customerContactSchema,
});

export const sessionBookingRequestSchema = z.object({
  mode: z.literal("SESSION"),
  service: slug,
  hours: z.number().int().min(1).max(4),
  startsAt: z.string().datetime({ offset: true }),
  project: projectDetailsSchema.partial({ songTitle: true }).extend({ songTitle: plainText(120).default("") }),
  customer: customerContactSchema,
});

export const bookingRequestSchema = z.discriminatedUnion("mode", [
  deliveryBookingRequestSchema,
  sessionBookingRequestSchema,
]);

export type BookingRequest = z.infer<typeof bookingRequestSchema>;
