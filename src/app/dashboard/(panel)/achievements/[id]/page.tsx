import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { PageHeader } from "@/components/admin/PageHeader";
import { DeleteForm } from "@/components/admin/DeleteForm";
import { deleteAchievement } from "@/server/admin/actions/achievements";
import { AchievementForm } from "../AchievementForm";

export default async function EditAchievement({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, portfolio] = await Promise.all([
    db.achievement.findUnique({ where: { id } }),
    db.portfolioItem.findMany({ select: { id: true, title: true, artist: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  if (!item) notFound();
  return (
    <>
      <PageHeader
        title={item.titleEs}
        back={{ href: "/dashboard/achievements", label: "Logros" }}
        actions={<DeleteForm action={deleteAchievement.bind(null, item.id)} what="este logro" />}
      />
      <AchievementForm item={item} portfolio={portfolio} />
    </>
  );
}
