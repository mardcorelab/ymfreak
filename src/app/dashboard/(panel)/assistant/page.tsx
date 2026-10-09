import Link from "next/link";
import { requireAdmin } from "@/server/auth/admin";
import { getAgentSettings } from "@/server/agent/settings";
import { agentAvailable } from "@/server/agent/model";
import { saveAgentSettings } from "@/server/admin/actions/settings";
import { AdminForm } from "@/components/admin/AdminForm";
import { TextArea, TextField } from "@/components/admin/fields";
import { PageHeader } from "@/components/admin/PageHeader";

export const dynamic = "force-dynamic";

const EXAMPLE = `Ejemplos de lo que puedes escribir:
• Saluda con energía, como si el cliente entrara al estudio.
• Si alguien duda entre mezcla y mezcla+mastering, recomienda mezcla+mastering para que suene listo para plataformas.
• A los artistas de bachata y merengue, menciona la nominación al Latin Grammy.
• Nunca uses la palabra «barato».
• Si preguntan por colaboraciones o featuring, pide que me escriban al correo.`;

export default async function AssistantAdmin() {
  await requireAdmin();
  const agent = await getAgentSettings();
  return (
    <>
      <PageHeader
        title="Asistente"
        description={
          agentAvailable() ? (
            <>
              Dale nombre y entrénalo a tu manera. Lo que escribas aquí guía cómo conversa y vende; los precios, fechas y políticas los sigue leyendo siempre de tu
              panel, así que nunca podrá inventarlos. Revisa cómo le va en{" "}
              <Link href="/dashboard/conversations" className="underline underline-offset-4">
                Conversaciones
              </Link>
              .
            </>
          ) : (
            "El asistente está apagado: falta ANTHROPIC_API_KEY en Vercel."
          )
        }
      />
      <div className="max-w-2xl">
        <AdminForm action={saveAgentSettings}>
          <TextField name="name" label="Nombre del asistente" defaultValue={agent.name} hint="Déjalo vacío para que se presente como «el asistente del estudio»." />
          <TextArea name="notes" label="Tus instrucciones" defaultValue={agent.notes} rows={12} hint={<span className="whitespace-pre-line">{EXAMPLE}</span>} />
        </AdminForm>
      </div>
    </>
  );
}
