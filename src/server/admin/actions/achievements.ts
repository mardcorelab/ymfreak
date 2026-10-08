"use server";

import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { audit, requireAdmin } from "@/server/auth/admin";
import { achievementSchema } from "@/lib/validators/admin";
import { checkbox, optionalInt, optionalText, text } from "@/lib/form-data";
import { failure, invalid, refreshSite, type ActionState } from "../common";

export async function saveAchievement(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = achievementSchema.safeParse({
    kind: text(fd, "kind"),
    titleEs: text(fd, "titleEs"),
    titleEn: text(fd, "titleEn"),
    detailEs: text(fd, "detailEs"),
    detailEn: text(fd, "detailEn"),
    year: optionalInt(fd, "year"),
    highlight: checkbox(fd, "highlight"),
    published: checkbox(fd, "published"),
    portfolioId: optionalText(fd, "portfolioId"),
    sortOrder: optionalInt(fd, "sortOrder") ?? 0,
  });
  if (!parsed.success) return invalid(parsed.error);
  const data = parsed.data;
  if (data.portfolioId && !(await db.portfolioItem.findUnique({ where: { id: data.portfolioId }, select: { id: true } }))) {
    return failure("Trabajo relacionado: ya no existe.");
  }

  if (id) {
    if (!(await db.achievement.findUnique({ where: { id }, select: { id: true } }))) return failure("Este logro ya no existe.");
    await db.achievement.update({ where: { id }, data });
    await audit("achievement.update", "Achievement", id, data);
    refreshSite();
    return { status: "ok", message: "Cambios guardados." };
  }
  const created = await db.achievement.create({ data });
  await audit("achievement.create", "Achievement", created.id, data);
  refreshSite();
  redirect("/dashboard/achievements?saved=1");
}

export async function deleteAchievement(id: string): Promise<void> {
  await requireAdmin();
  await db.achievement.delete({ where: { id } }).catch(() => null);
  await audit("achievement.delete", "Achievement", id);
  refreshSite();
  redirect("/dashboard/achievements?deleted=1");
}
