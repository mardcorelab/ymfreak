import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminForm } from "@/components/admin/AdminForm";
import { TextField } from "@/components/admin/fields";
import { loginAction } from "@/server/admin/actions/auth";
import { adminConfig, currentAdmin } from "@/server/auth/admin";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentAdmin()) redirect("/dashboard");
  const config = adminConfig();

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-16">
      <p className="type-name text-5xl">YM Freak</p>
      <h1 className="mt-6 text-xl font-semibold">Entrar al panel</h1>

      {!config.ok ? (
        <div role="alert" className="mt-6 rounded-lg border border-amber-400/40 bg-amber-500/10 p-4 text-sm leading-relaxed">
          {config.reason === "WEAK_PASSWORD"
            ? "ADMIN_PASSWORD es demasiado corta: usa al menos 12 caracteres. Cámbiala en Vercel y vuelve a publicar."
            : config.reason === "BAD_EMAIL"
              ? "ADMIN_EMAIL no es un correo válido. Corrígelo en Vercel y vuelve a publicar."
              : "El panel aún no está activado. Añade ADMIN_EMAIL y ADMIN_PASSWORD en Vercel (Settings → Environment Variables) y vuelve a publicar."}
        </div>
      ) : (
        <div className="mt-6">
          <AdminForm action={loginAction} submitLabel="Entrar">
            <TextField name="email" label="Correo" type="email" inputMode="email" />
            <TextField name="password" label="Contraseña" type="password" />
          </AdminForm>
        </div>
      )}
    </main>
  );
}
