import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { PageHeader } from "@/components/admin/PageHeader";
import { DeleteForm } from "@/components/admin/DeleteForm";
import { deleteTestimonial } from "@/server/admin/actions/testimonials";
import { TestimonialForm } from "../TestimonialForm";

export default async function EditTestimonial({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await db.testimonial.findUnique({ where: { id } });
  if (!item) notFound();
  return (
    <>
      <PageHeader
        title={item.author}
        back={{ href: "/dashboard/testimonials", label: "Testimonios" }}
        actions={<DeleteForm action={deleteTestimonial.bind(null, item.id)} what="este testimonio" />}
      />
      <TestimonialForm item={item} />
    </>
  );
}
