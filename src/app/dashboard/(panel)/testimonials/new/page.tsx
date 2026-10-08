import { PageHeader } from "@/components/admin/PageHeader";
import { TestimonialForm } from "../TestimonialForm";

export default function NewTestimonial() {
  return (
    <>
      <PageHeader title="Añadir testimonio" back={{ href: "/dashboard/testimonials", label: "Testimonios" }} />
      <TestimonialForm item={null} />
    </>
  );
}
