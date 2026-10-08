import { PageHeader } from "@/components/admin/PageHeader";
import { PortfolioForm } from "../PortfolioForm";

export default function NewPortfolioItem() {
  return (
    <>
      <PageHeader title="Añadir trabajo" back={{ href: "/dashboard/portfolio", label: "Trabajos" }} />
      <PortfolioForm item={null} />
    </>
  );
}
