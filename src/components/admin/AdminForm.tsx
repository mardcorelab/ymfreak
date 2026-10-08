"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/server/admin/common";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center rounded-full bg-bone px-6 text-sm font-semibold text-studio transition hover:bg-white disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Guardando…" : label}
    </button>
  );
}

/**
 * Dashboard form: posts to a server action, shows what went wrong in plain
 * Spanish, and confirms when changes are saved.
 */
export function AdminForm({
  action,
  submitLabel = "Guardar cambios",
  children,
}: {
  action: Action;
  submitLabel?: string;
  children: ReactNode;
}) {
  const [state, formAction] = useActionState(action, { status: "idle" });

  return (
    <form action={formAction} className="grid gap-6" noValidate>
      {state.status === "error" && (
        <div role="alert" className="rounded-lg border border-red-400/40 bg-red-500/10 p-4 text-sm">
          <p className="font-semibold">No se guardó. Revisa esto:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {state.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {children}
      <div className="flex flex-wrap items-center gap-4 border-t border-rule pt-6">
        <SubmitButton label={submitLabel} />
        {state.status === "ok" && (
          <p role="status" className="text-sm text-emerald-300">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
