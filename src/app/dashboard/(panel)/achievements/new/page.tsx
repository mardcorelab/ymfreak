import { db } from "@/server/db";
import { PageHeader } from "@/components/admin/PageHeader";
import { AchievementForm } from "../AchievementForm";

export default async function NewAchievement() {
  const portfolio = await db.portfolioItem.findMany({ select: { id: true, title: true, artist: true }, orderBy: { sortOrder: "asc" } });
  return (
    <>
      <PageHeader title="Añadir logro" back={{ href: "/dashboard/achievements", label: "Logros" }} />
      <AchievementForm item={null} portfolio={portfolio} />
    </>
  );
}
