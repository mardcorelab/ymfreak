"use server";

import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { audit, requireAdmin } from "@/server/auth/admin";
import { serviceSchema } from "@/lib/validators/admin";
import { checkbox, dollarsToCents, lines, optionalInt, slugify, text } from "@/lib/form-data";
import { failure, invalid, refreshSite, type ActionState } from "../common";

function read(fd: FormData) {
  return serviceSchema.safeParse({
    nameEs: text(fd, "nameEs"),
    nameEn: text(fd, "nameEn"),
    descriptionEs: text(fd, "descriptionEs"),
    descriptionEn: text(fd, "descriptionEn"),
    includesEs: lines(fd, "includesEs"),
    includesEn: lines(fd, "includesEn"),
    priceCents: dollarsToCents(text(fd, "price")),
    pricingUnit: text(fd, "pricingUnit"),
    bookingMode: text(fd, "bookingMode"),
    turnaroundDays: optionalInt(fd, "turnaroundDays"),
    sessionMinutes: optionalInt(fd, "sessionMinutes"),
    revisionsIncluded: optionalInt(fd, "revisionsIncluded") ?? 0,
    active: checkbox(fd, "active"),
    sortOrder: optionalInt(fd, "sortOrder") ?? 0,
  });
}

export async function saveService(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = read(fd);
  if (!parsed.success) return invalid(parsed.error);
  const data = {
    ...parsed.data,
    // Keep only the field that applies to the booking mode.
    turnaroundDays: parsed.data.bookingMode === "DELIVERY" ? parsed.data.turnaroundDays : null,
    sessionMinutes: parsed.data.bookingMode === "SESSION" ? parsed.data.sessionMinutes : null,
  };

  if (id) {
    const before = await db.service.findUnique({ where: { id } });
    if (!before) return failure("Este servicio ya no existe.");
    await db.service.update({ where: { id }, data });
    await audit("service.update", "Service", id, { before: { priceCents: before.priceCents, active: before.active }, after: data });
    refreshSite();
    return { status: "ok", message: "Cambios guardados. La web ya muestra la nueva información." };
  }

  const base = slugify(data.nameEs) || "servicio";
  let slug = base;
  for (let i = 2; await db.service.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
  const created = await db.service.create({ data: { ...data, slug } });
  await audit("service.create", "Service", created.id, data);
  refreshSite();
  redirect("/dashboard/services?saved=1");
}
