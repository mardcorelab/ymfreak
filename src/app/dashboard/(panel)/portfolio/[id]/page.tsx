import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { PageHeader } from "@/components/admin/PageHeader";
import { DeleteForm } from "@/components/admin/DeleteForm";
import { deletePortfolioItem } from "@/server/admin/actions/portfolio";
import { PortfolioForm } from "../PortfolioForm";

export default async function EditPortfolioItem({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await db.portfolioItem.findUnique({ where: { id } });
  if (!item) notFound();
  return (
    <>
      <PageHeader
        title={item.title}
        back={{ href: "/dashboard/portfolio", label: "Trabajos" }}
        actions={<DeleteForm action={deletePortfolioItem.bind(null, item.id)} what={`«${item.title}»`} />}
      />
      <PortfolioForm item={item} />
    </>
  );
}
