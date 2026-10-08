"use server";

import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { audit, requireAdmin } from "@/server/auth/admin";
import { knowledgeSchema } from "@/lib/validators/admin";
import { checkbox, list, optionalInt, text } from "@/lib/form-data";
import { failure, invalid, refreshSite, type ActionState } from "../common";

export async function saveKnowledgeEntry(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = knowledgeSchema.safeParse({
    kind: text(fd, "kind"),
    questionEs: text(fd, "questionEs"),
    questionEn: text(fd, "questionEn"),
    answerEs: text(fd, "answerEs"),
    answerEn: text(fd, "answerEn"),
    tags: list(fd, "tags"),
    active: checkbox(fd, "active"),
    sortOrder: optionalInt(fd, "sortOrder") ?? 0,
  });
  if (!parsed.success) return invalid(parsed.error);

  if (id) {
    if (!(await db.knowledgeEntry.findUnique({ where: { id }, select: { id: true } }))) return failure("Esta pregunta ya no existe.");
    await db.knowledgeEntry.update({ where: { id }, data: parsed.data });
    await audit("knowledge.update", "KnowledgeEntry", id, parsed.data);
    refreshSite();
    return { status: "ok", message: "Cambios guardados." };
  }
  const created = await db.knowledgeEntry.create({ data: parsed.data });
  await audit("knowledge.create", "KnowledgeEntry", created.id, parsed.data);
  refreshSite();
  redirect("/dashboard/knowledge?saved=1");
}

export async function deleteKnowledgeEntry(id: string): Promise<void> {
  await requireAdmin();
  await db.knowledgeEntry.delete({ where: { id } }).catch(() => null);
  await audit("knowledge.delete", "KnowledgeEntry", id);
  refreshSite();
  redirect("/dashboard/knowledge?deleted=1");
}
