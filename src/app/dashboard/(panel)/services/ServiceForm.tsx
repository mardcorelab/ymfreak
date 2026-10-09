import type { Service } from "@prisma/client";
import { AdminForm } from "@/components/admin/AdminForm";
import { Checkbox, Group, Pair, Select, TextArea, TextField } from "@/components/admin/fields";
import { centsToDollars } from "@/lib/form-data";
import { saveService } from "@/server/admin/actions/services";

const STAGES = [
  ["idea", "…es una idea o una letra"],
  ["vocals", "…tiene pista y falta grabar la voz"],
  ["recorded", "…ya está grabada"],
  ["mixed", "…ya está mezclada"],
  ["other", "…necesita otra cosa (arreglos, DJ, anuncios, asesoría)"],
] as const;

export function ServiceForm({ service }: { service: Service | null }) {
  const s = service;
  return (
    <AdminForm action={saveService.bind(null, s?.id ?? null)} submitLabel={s ? "Guardar cambios" : "Crear servicio"}>
      <Group title="Precio y entrega">
        <div className="grid gap-6 sm:grid-cols-3">
          <TextField name="price" label="Precio (USD)" defaultValue={s ? centsToDollars(s.priceCents) : ""} inputMode="decimal" placeholder="150" />
          <Select
            name="pricingUnit"
            label="Se cobra"
            defaultValue={s?.pricingUnit ?? "PER_SONG"}
            options={[
              { value: "PER_SONG", label: "Por canción" },
              { value: "PER_HOUR", label: "Por hora" },
              { value: "FLAT", label: "Por pieza" },
            ]}
          />
          <Select
            name="bookingMode"
            label="Tipo"
            defaultValue={s?.bookingMode ?? "DELIVERY"}
            options={[
              { value: "DELIVERY", label: "Trabajo con entrega" },
              { value: "SESSION", label: "Sesión por videollamada" },
            ]}
          />
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          <TextField name="turnaroundDays" label="Días laborables de entrega" defaultValue={s?.turnaroundDays} inputMode="numeric" hint="Solo para trabajos con entrega." />
          <TextField name="sessionMinutes" label="Duración de la sesión (min)" defaultValue={s?.sessionMinutes} inputMode="numeric" hint="Solo para sesiones." />
          <TextField name="revisionsIncluded" label="Revisiones incluidas" defaultValue={s?.revisionsIncluded ?? 0} inputMode="numeric" />
        </div>
      </Group>

      <Group title="Textos">
        <Pair>
          <TextField name="nameEs" label="Nombre (español)" defaultValue={s?.nameEs} />
          <TextField name="nameEn" label="Nombre (inglés)" defaultValue={s?.nameEn} />
        </Pair>
        <Pair>
          <TextArea name="descriptionEs" label="Descripción corta (español)" defaultValue={s?.descriptionEs} rows={2} />
          <TextArea name="descriptionEn" label="Descripción corta (inglés)" defaultValue={s?.descriptionEn} rows={2} />
        </Pair>
        <Pair>
          <TextArea name="includesEs" label="Qué incluye (español)" defaultValue={s?.includesEs.join("\n")} rows={6} hint="Una cosa por línea. Déjalo vacío si no aplica." />
          <TextArea name="includesEn" label="Qué incluye (inglés)" defaultValue={s?.includesEn.join("\n")} rows={6} hint="Mismo número de líneas que en español." />
        </Pair>
      </Group>

      <Group title="Página de inicio">
        <Pair>
          <TextField
            name="promiseEs"
            label="Frase de venta (español)"
            defaultValue={s?.promiseEs}
            hint="Lo que el cliente gana, en una línea. Sale en la tarjeta del inicio. Vacío: se usa la descripción."
          />
          <TextField name="promiseEn" label="Frase de venta (inglés)" defaultValue={s?.promiseEn} />
        </Pair>
        <fieldset>
          <legend className="text-[0.95rem]">Recomendar en la guía «Encuentra tu servicio» cuando la canción…</legend>
          <div className="mt-3 grid gap-1 sm:grid-cols-2">
            {STAGES.map(([value, label]) => (
              <Checkbox key={value} name={`stage_${value}`} label={label} defaultChecked={s?.guideStages.includes(value) ?? false} />
            ))}
          </div>
        </fieldset>
      </Group>

      <div className="grid gap-6 sm:grid-cols-[1fr_12rem]">
        <Checkbox name="active" label="Visible en la web" defaultChecked={s?.active ?? true} hint="Si lo desmarcas, el servicio se oculta pero no se borra." />
        <TextField name="sortOrder" label="Orden" defaultValue={s?.sortOrder ?? 100} inputMode="numeric" hint="Menor número, más arriba." />
      </div>
    </AdminForm>
  );
}
