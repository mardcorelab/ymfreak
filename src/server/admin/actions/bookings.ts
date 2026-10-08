"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { audit, requireAdmin } from "@/server/auth/admin";
import { BOOKING_STATUSES } from "@/server/domain/booking-status";
import { isValidLocalDate, parseLocalTime, zonedToUtc } from "@/server/domain/calendar";
import { parseSetting } from "@/server/settings/schemas";
import { markBalancePaidManually, transitionAsAdmin } from "@/server/booking/admin-ops";
import { createBooking } from "@/server/booking/engine";
import { bookingRequestSchema } from "@/lib/validators/booking";
import { checkbox, optionalInt, optionalText, text } from "@/lib/form-data";
import { dateColumn } from "@/server/booking/code";
import { failure, invalid, refreshSite, type ActionState } from "../common";

const ENGINE_MESSAGES: Record<string, string> = {
  UNKNOWN_SERVICE: "El servicio no existe o está oculto.",
  WRONG_MODE: "Ese servicio no se reserva de esa forma.",
  INVALID_QUANTITY: "Cantidad no válida.",
  NO_CAPACITY: "No hay capacidad disponible en los próximos meses. Revisa los días bloqueados.",
  INVALID_DATE: "Fecha no válida.",
  SLOT_TAKEN: "Ese horario ya no está libre (o está fuera de tu horario laboral o con poca antelación).",
  BOOKING_CLOSED: "Las reservas están cerradas.",
};

export async function transitionBooking(id: string, to: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const status = z.enum(BOOKING_STATUSES).safeParse(to);
  if (!status.success) return failure("Estado no válido.");
  const result = await transitionAsAdmin(id, status.data, optionalText(fd, "note") ?? undefined);
  if (!result.ok) return failure(result.message);
  await audit("booking.status", "Booking", id, { to: status.data });
  refreshSite();
  return { status: "ok", message: result.message };
}

export async function markBalancePaid(id: string, _prev: ActionState): Promise<ActionState> {
  await requireAdmin();
  const result = await markBalancePaidManually(id);
  if (!result.ok) return failure(result.message);
  await audit("booking.balance_paid_manual", "Booking", id);
  return { status: "ok", message: result.message };
}

export async function createManualBooking(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const slug = text(fd, "service");
  const service = await db.service.findUnique({ where: { slug } });
  if (!service) return failure("Elige un servicio.");

  const rulesRow = await db.setting.findUnique({ where: { key: "business_rules" } });
  const tz = rulesRow ? parseSetting("business_rules", rulesRow.value).timeZone : "America/Santo_Domingo";
  const quantity = optionalInt(fd, "quantity") ?? 1;
  const common = {
    project: {
      songTitle: text(fd, "songTitle"),
      artistName: text(fd, "artistName"),
      notes: text(fd, "notes"),
      referenceLinks: [],
    },
    customer: {
      name: text(fd, "name"),
      email: text(fd, "email"),
      ...(optionalText(fd, "phone") ? { phone: text(fd, "phone") } : {}),
      locale: text(fd, "locale") === "en" ? ("en" as const) : ("es" as const),
    },
  };

  let request: unknown;
  if (service.bookingMode === "SESSION") {
    const date = text(fd, "date");
    const time = text(fd, "time");
    let startsAt = "";
    try {
      if (isValidLocalDate(date)) startsAt = zonedToUtc(date, parseLocalTime(time), tz).toISOString();
    } catch {
      startsAt = "";
    }
    if (!startsAt) return failure("Fecha y hora: elige una fecha y una hora válidas para la sesión.");
    request = { mode: "SESSION", service: slug, hours: quantity, startsAt, ...common, project: { ...common.project } };
  } else {
    request = { mode: "DELIVERY", services: [slug], songs: quantity, ...common };
  }

  const parsed = bookingRequestSchema.safeParse(request);
  if (!parsed.success) {
    const labels: Record<string, string> = {
      "project.songTitle": "Canción: obligatoria",
      "project.artistName": "Artista: obligatorio",
      "customer.name": "Nombre del cliente: obligatorio",
      "customer.email": "Correo del cliente: no es válido",
      "customer.phone": "Teléfono: no es válido",
      songs: "Cantidad: entre 1 y 20",
      hours: "Horas: entre 1 y 4",
    };
    return { status: "error", errors: [...new Set(parsed.error.issues.map((i) => labels[i.path.join(".")] ?? `Revisa el campo ${i.path.join(".")}`))] };
  }

  const result = await createBooking(parsed.data, { source: "ADMIN" });
  if (!result.ok) return failure(ENGINE_MESSAGES[result.error] ?? "No se pudo crear la reserva.");
  await audit("booking.create_manual", "Booking", result.bookingId, { code: result.code });
  refreshSite();
  redirect(`/dashboard/bookings/${result.bookingId}?created=1`);
}

const blockSchema = z
  .object({
    from: z.string().refine(isValidLocalDate, "Desde: fecha no válida"),
    to: z.string().refine(isValidLocalDate, "Hasta: fecha no válida"),
    reason: z.string().max(120, "Motivo: máximo 120 caracteres").nullable(),
  })
  .refine((b) => b.from <= b.to, { message: "La fecha «hasta» debe ser igual o posterior a «desde»" });

export async function addBlockedPeriod(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = blockSchema.safeParse({ from: text(fd, "from"), to: text(fd, "to") || text(fd, "from"), reason: optionalText(fd, "reason") });
  if (!parsed.success) return invalid(parsed.error);
  const row = await db.blockedPeriod.create({
    data: { fromDate: dateColumn(parsed.data.from), toDate: dateColumn(parsed.data.to), reason: parsed.data.reason },
  });
  await audit("availability.block", "BlockedPeriod", row.id, parsed.data);
  refreshSite();
  return { status: "ok", message: "Días bloqueados. Ya no se ofrecen para nuevas reservas." };
}

export async function deleteBlockedPeriod(id: string): Promise<void> {
  await requireAdmin();
  await db.blockedPeriod.delete({ where: { id } }).catch(() => null);
  await audit("availability.unblock", "BlockedPeriod", id);
  refreshSite();
  redirect("/dashboard/availability?unblocked=1");
}

export async function saveBookingSwitch(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const row = await db.setting.findUnique({ where: { key: "booking" } });
  const current = row ? parseSetting("booking", row.value) : { enabled: false, holdMinutes: 30 };
  const holdMinutes = optionalInt(fd, "holdMinutes") ?? current.holdMinutes;
  if (Number.isNaN(holdMinutes) || holdMinutes < 10 || holdMinutes > 1440) {
    return failure("Minutos para pagar: escribe un número entre 10 y 1440.");
  }
  const value = parseSetting("booking", { enabled: checkbox(fd, "enabled"), holdMinutes });
  await db.setting.upsert({ where: { key: "booking" }, update: { value }, create: { key: "booking", value } });
  await audit("settings.booking", "Setting", "booking", value);
  refreshSite();
  return { status: "ok", message: value.enabled ? "Reservas en línea abiertas al público." : "Reservas en línea cerradas al público (tú puedes seguir probándolas)." };
}

export async function changeBookingStatus(id: string, prev: ActionState, fd: FormData): Promise<ActionState> {
  return transitionBooking(id, text(fd, "to"), prev, fd);
}
