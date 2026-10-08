import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { PageHeader } from "@/components/admin/PageHeader";
import { ServiceForm } from "../ServiceForm";

export default async function EditService({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = await db.service.findUnique({ where: { id } });
  if (!service) notFound();
  return (
    <>
      <PageHeader title={service.nameEs} back={{ href: "/dashboard/services", label: "Servicios" }} />
      <ServiceForm service={service} />
    </>
  );
}
