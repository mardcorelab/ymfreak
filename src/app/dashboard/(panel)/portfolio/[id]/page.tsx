import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { PageHeader } from "@/components/admin/PageHeader";
import { DeleteForm } from "@/components/admin/DeleteForm";
import { deletePortfolioItem, refreshPlatformLinks, savePlatformLinks } from "@/server/admin/actions/portfolio";
import { PLATFORMS } from "@/server/admin/media";
import { TextField } from "@/components/admin/fields";
import { AdminForm } from "@/components/admin/AdminForm";
import { siteUrl } from "@/lib/seo";
import { CopyField } from "@/components/admin/CopyField";
import { PortfolioForm } from "../PortfolioForm";

export default async function EditPortfolioItem({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await db.portfolioItem.findUnique({ where: { id } });
  if (!item) notFound();
  const current = new Map(
    (Array.isArray(item.platformLinks) ? (item.platformLinks as { platform?: string; url?: string }[]) : []).flatMap((l) =>
      typeof l?.platform === "string" && typeof l?.url === "string" ? [[l.platform, l.url] as const] : [],
    ),
  );
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
        <div className="mt-6">
          <AdminForm action={savePlatformLinks.bind(null, item.id)} submitLabel="Guardar enlaces">
            <p className="text-xs text-ash">Pega el enlace del lanzamiento en cada plataforma donde esté. Los vacíos no se muestran. El de YouTube (un video, o el álbum completo en YouTube Music) también suma sus reproducciones a la web.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {PLATFORMS.map((p) => (
                <TextField key={p.key} name={`pl_${p.key}`} label={p.label} type="url" defaultValue={current.get(p.key) ?? (p.key === "spotify" && item.embedProvider === "SPOTIFY" ? item.externalUrl : p.key === "youtube" && item.embedProvider === "YOUTUBE" ? item.externalUrl : "")} />
              ))}
            </div>
          </AdminForm>
        </div>
        {process.env.SONGLINK_API_KEY && (
          <div className="mt-5">
            <AdminForm action={refreshPlatformLinks.bind(null, item.id)} submitLabel="Buscar automáticamente">
              <p className="text-xs text-ash">Busca este lanzamiento en todas las plataformas con song.link.</p>
            </AdminForm>
          </div>
        )}
      </section>
    </>
  );
}
