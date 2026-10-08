/**
 * Maps the assistant's propose_booking arguments onto the same booking
 * request schema the /book form uses, so both paths validate identically.
 */
import { z } from "zod";
import { bookingRequestSchema } from "../../lib/validators/booking";

export const proposeInput = z.object({
  mode: z.enum(["DELIVERY", "SESSION"]),
  services: z.array(z.string().max(60)).max(4).optional(),
  songs: z.number().int().optional(),
  service: z.string().max(60).optional(),
  hours: z.number().int().optional(),
  starts_at: z.string().max(40).optional(),
  requested_delivery_date: z.string().max(10).optional(),
  name: z.string().max(200),
  email: z.string().max(254),
  phone: z.string().max(40).optional(),
  artist_name: z.string().max(200),
  song_title: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  reference_link: z.string().max(500).optional(),
});

export function toBookingRequest(input: z.infer<typeof proposeInput>, locale: "es" | "en") {
  const customer = {
    name: input.name,
    email: input.email,
    ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
    locale,
  };
  const project = {
    artistName: input.artist_name,
    songTitle: input.song_title ?? "",
    notes: input.notes ?? "",
    referenceLinks: input.reference_link?.trim() ? [input.reference_link.trim()] : [],
  };
  const raw =
    input.mode === "DELIVERY"
      ? {
          mode: "DELIVERY",
          services: input.services ?? [],
          songs: input.songs ?? 1,
          ...(input.requested_delivery_date ? { requestedDeliveryDate: input.requested_delivery_date } : {}),
          customer,
          project,
        }
      : { mode: "SESSION", service: input.service ?? "", hours: input.hours ?? 1, startsAt: input.starts_at ?? "", customer, project };
  return bookingRequestSchema.safeParse(raw);
}

