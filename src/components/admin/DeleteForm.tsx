"use client";

/** Delete with an explicit confirmation, since it cannot be undone. */
export function DeleteForm({ action, what }: { action: () => Promise<void>; what: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`¿Eliminar ${what}? Esta acción no se puede deshacer.`)) e.preventDefault();
      }}
    >
      <button type="submit" className="min-h-11 rounded-full border border-red-400/40 px-5 text-sm text-red-300 hover:bg-red-500/10">
        Eliminar
      </button>
    </form>
  );
}
