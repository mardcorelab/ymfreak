import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { PageHeader } from "@/components/admin/PageHeader";
import { DeleteForm } from "@/components/admin/DeleteForm";
import { deletePortfolioItem, refreshPlatformLinks } from "@/server/admin/actions/portfolio";
import { AdminForm } from "@/components/admin/AdminForm";
import { siteUrl } from "@/lib/seo";
import { CopyField } from "@/components/admin/CopyField";
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
      <section className="mt-12 max-w-2xl rounded-lg border border-rule p-5">
        <h2 className="type-sub text-xl">Página del lanzamiento</h2>
        <p className="mt-1 text-sm text-ash">
          Una página para compartir con enlaces a todas las plataformas.{" "}
          {Array.isArray(item.platformLinks) && item.platformLinks.length > 0
            ? `Ahora mismo enlaza a ${item.platformLinks.length} plataformas.`
            : "Todavía solo enlaza a la plataforma original."}
        </p>
        <div className="mt-4">
          <CopyField label="Enlace para compartir" value={`${siteUrl()}/r/${item.slug}`} />
        </div>
        <div className="mt-5">
          <AdminForm action={refreshPlatformLinks.bind(null, item.id)} submitLabel="Buscar en todas las plataformas">
            <p className="text-xs text-ash">Busca este lanzamiento en Apple Music, YouTube Music, Amazon, Tidal, Deezer… (con song.link).</p>
          </AdminForm>
        </div>
      </section>
    </>
  );
}
