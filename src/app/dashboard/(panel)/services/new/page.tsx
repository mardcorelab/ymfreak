import { PageHeader } from "@/components/admin/PageHeader";
import { ServiceForm } from "../ServiceForm";

export default function NewService() {
  return (
    <>
      <PageHeader title="Nuevo servicio" back={{ href: "/dashboard/services", label: "Servicios" }} />
      <ServiceForm service={null} />
    </>
  );
}
