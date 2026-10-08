import { db } from "@/server/db";
import { parseSetting } from "@/server/settings/schemas";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminForm } from "@/components/admin/AdminForm";
import { Checkbox, Group, TextField } from "@/components/admin/fields";
import { centsToDollars } from "@/lib/form-data";
import { saveBusinessRules, saveContact } from "@/server/admin/actions/settings";

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export default async function SettingsAdmin() {
  const [contactRow, rulesRow] = await Promise.all([
    db.setting.findUnique({ where: { key: "contact" } }),
    db.setting.findUnique({ where: { key: "business_rules" } }),
  ]);
  const contact = contactRow ? parseSetting("contact", contactRow.value) : null;
  const rules = rulesRow ? parseSetting("business_rules", rulesRow.value) : null;

  return (
    <>
      <PageHeader title="Contacto y reglas" description="Lo que dejes vacío no se muestra en la web." />

      <section aria-labelledby="contact-h" className="mb-14">
        <h2 id="contact-h" className="type-sub mb-4 text-2xl">Contacto y redes</h2>
        <AdminForm action={saveContact}>
          <div className="grid gap-6 md:grid-cols-2">
            <TextField name="email" label="Correo" type="email" defaultValue={contact?.email} />
            <TextField
              name="whatsapp"
              label="WhatsApp"
              defaultValue={contact?.whatsapp}
              inputMode="tel"
              placeholder="18095551234"
              hint="Con código de país, solo números. Se usará para el botón de WhatsApp."
            />
            <TextField name="instagram" label="Instagram" type="url" defaultValue={contact?.instagram} placeholder="https://www.instagram.com/…" />
            <TextField name="youtube" label="YouTube" type="url" defaultValue={contact?.youtube} placeholder="https://www.youtube.com/@…" />
            <TextField name="spotify" label="Perfil de Spotify" type="url" defaultValue={contact?.spotify} placeholder="https://open.spotify.com/artist/…" />
            <TextField name="tiktok" label="TikTok" type="url" defaultValue={contact?.tiktok} placeholder="https://www.tiktok.com/@…" />
          </div>
        </AdminForm>
      </section>

      <section aria-labelledby="rules-h">
        <h2 id="rules-h" className="type-sub mb-2 text-2xl">Reglas del negocio</h2>
        <p className="mb-4 max-w-[62ch] text-sm text-ash">
          Se usan para calcular fechas de entrega, depósitos y cancelaciones cuando se activen las reservas. Horario en hora de República Dominicana.
        </p>
        <AdminForm action={saveBusinessRules}>
          <Group title="Horario">
            <div className="flex flex-wrap gap-x-6">
              {DAYS.map((label, i) => (
                <Checkbox key={label} name={`day${i + 1}`} label={label} defaultChecked={rules?.workingWeekdays.includes(i + 1) ?? i < 5} />
              ))}
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <TextField name="workdayStart" label="Desde" type="time" defaultValue={rules?.workdayStart ?? "08:00"} />
              <TextField name="workdayEnd" label="Hasta" type="time" defaultValue={rules?.workdayEnd ?? "18:00"} />
            </div>
          </Group>
          <Group title="Capacidad">
            <div className="grid gap-6 sm:grid-cols-3">
              <TextField name="dailyProjectStarts" label="Proyectos nuevos por día" defaultValue={rules?.dailyProjectStarts ?? 2} inputMode="numeric" />
              <TextField name="leadWorkingDays" label="Días antes de empezar" defaultValue={rules?.leadWorkingDays ?? 1} inputMode="numeric" hint="1 = empieza el siguiente día laborable." />
              <TextField name="sessionLeadHours" label="Antelación mínima para sesiones (horas)" defaultValue={rules?.sessionLeadHours ?? 12} inputMode="numeric" />
            </div>
          </Group>
          <Group title="Pagos y cancelaciones">
            <div className="grid gap-6 sm:grid-cols-3">
              <TextField name="depositPercent" label="Depósito para reservar (%)" defaultValue={rules?.depositPercent ?? 50} inputMode="numeric" />
              <TextField name="revisionFee" label="Revisión adicional (USD)" defaultValue={rules ? centsToDollars(rules.revisionFeeCents) : "20"} inputMode="decimal" />
              <TextField name="cancellationWindowHours" label="Horas para cancelar con reembolso" defaultValue={rules?.cancellationWindowHours ?? 24} inputMode="numeric" />
            </div>
          </Group>
        </AdminForm>
      </section>
    </>
  );
}
