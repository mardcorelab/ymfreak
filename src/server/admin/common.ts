import "server-only";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { issuesToMessages } from "@/lib/validators/admin";

export type ActionState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; errors: string[] };

export const IDLE: ActionState = { status: "idle" };

export function invalid(error: z.ZodError): ActionState {
  return { status: "error", errors: issuesToMessages(error) };
}

export function failure(message: string): ActionState {
  return { status: "error", errors: [message] };
}

/** Refreshes every public page (both languages) and the dashboard. */
export function refreshSite(): void {
  revalidatePath("/[locale]", "layout");
  revalidatePath("/dashboard", "layout");
}
