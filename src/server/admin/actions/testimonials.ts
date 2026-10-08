"use server";

import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { audit, requireAdmin } from "@/server/auth/admin";
import { testimonialSchema } from "@/lib/validators/admin";
import { checkbox, optionalInt, optionalText, text } from "@/lib/form-data";
import { failure, invalid, refreshSite, type ActionState } from "../common";

export async function saveTestimonial(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = testimonialSchema.safeParse({
    author: text(fd, "author"),
    role: optionalText(fd, "role"),
    quoteEs: text(fd, "quoteEs"),
    quoteEn: text(fd, "quoteEn"),
    published: checkbox(fd, "published"),
    sortOrder: optionalInt(fd, "sortOrder") ?? 0,
  });
  if (!parsed.success) return invalid(parsed.error);

  if (id) {
    if (!(await db.testimonial.findUnique({ where: { id }, select: { id: true } }))) return failure("Este testimonio ya no existe.");
    await db.testimonial.update({ where: { id }, data: parsed.data });
    await audit("testimonial.update", "Testimonial", id, parsed.data);
    refreshSite();
    return { status: "ok", message: "Cambios guardados." };
  }
  const created = await db.testimonial.create({ data: parsed.data });
  await audit("testimonial.create", "Testimonial", created.id, parsed.data);
  refreshSite();
  redirect("/dashboard/testimonials?saved=1");
}

export async function deleteTestimonial(id: string): Promise<void> {
  await requireAdmin();
  await db.testimonial.delete({ where: { id } }).catch(() => null);
  await audit("testimonial.delete", "Testimonial", id);
  refreshSite();
  redirect("/dashboard/testimonials?deleted=1");
}
