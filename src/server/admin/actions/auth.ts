"use server";

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/server/auth/admin";
import { text } from "@/lib/form-data";
import { failure, type ActionState } from "../common";

const MESSAGES = {
  NOT_CONFIGURED:
    "El acceso al panel no está configurado. Añade ADMIN_EMAIL y ADMIN_PASSWORD (mínimo 12 caracteres) en Vercel y vuelve a publicar.",
  INVALID: "Correo o contraseña incorrectos.",
  RATE_LIMITED: "Demasiados intentos fallidos. Espera 15 minutos y vuelve a intentarlo.",
} as const;

export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const result = await signIn(text(fd, "email"), typeof fd.get("password") === "string" ? (fd.get("password") as string) : "");
  if (!result.ok) return failure(MESSAGES[result.reason]);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await signOut();
  redirect("/dashboard/login");
}
