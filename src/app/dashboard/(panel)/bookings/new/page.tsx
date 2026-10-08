import { db } from "@/server/db";
import { AdminForm } from "@/components/admin/AdminForm";
import { Group, Pair, Select, TextArea, TextField } from "@/components/admin/fields";
import { PageHeader } from "@/components/admin/PageHeader";
import { createManualBooking } from "@/server/admin/actions/bookings";

export default async function NewManualBooking() {
  const services = await db.service.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  return (
    <>
      <PageHeader
        title="Reserva manual"
        back={{ href: "/dashboard/bookings", label: "Reservas" }}
        description="Para clientes que reservan contigo por WhatsApp o en persona. Se crea confirmada, con el depósito registrado como pagado fuera de la web, y respeta tu capacidad y tus horarios."
      />
      <AdminForm action={createManualBooking} submitLabel="Crear reserva">
        <Group title="Servicio">
          <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <Select
              name="service"
              label="Servicio"
              options={services.map((s) => ({ value: s.slug, label: `${s.nameEs} (${s.bookingMode === "SESSION" ? "sesión" : "entrega"})` }))}
            />
            <TextField name="quantity" label="Canciones u horas" defaultValue={1} inputMode="numeric" />
          </div>
          <p className="text-xs text-ash">En trabajos con entrega, la fecha se calcula sola con tu calendario. Para sesiones, indica día y hora:</p>
          <Pair>
            <TextField name="date" label="Día de la sesión" type="date" hint="Solo para sesiones." />
            <TextField name="time" label="Hora de la sesión" type="time" hint="Hora de República Dominicana." />
          </Pair>
        </Group>
        <Group title="Cliente y proyecto">
          <Pair>
            <TextField name="name" label="Nombre del cliente" />
            <TextField name="email" label="Correo del cliente" type="email" />
          </Pair>
          <Pair>
            <TextField name="phone" label="Teléfono (opcional)" inputMode="tel" />
            <Select name="locale" label="Idioma del cliente" options={[{ value: "es", label: "Español" }, { value: "en", label: "Inglés" }]} />
          </Pair>
          <Pair>
            <TextField name="artistName" label="Artista" />
            <TextField name="songTitle" label="Canción" />
          </Pair>
          <TextArea name="notes" label="Notas (opcional)" rows={3} />
        </Group>
      </AdminForm>
    </>
  );
}
