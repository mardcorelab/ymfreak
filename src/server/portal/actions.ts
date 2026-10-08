"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "../db";
import { clientIp } from "../auth/admin";
import { allowRate } from "../rate-limit";
import { transitionBookingAs } from "../booking/admin-ops";
import { currentClient, endClientSession, startClientSession } from "./session";

export type PortalState =
  | { status: "idle" }
  | { status: "ok"; code?: "FILES_SENT" | "REVISION_REQUESTED" | "REVISION_REQUESTED_FEE" }
  | { status: "error"; error: "NO_MATCH" | "RATE_LIMITED" | "INVALID" | "URL" | "NOTE" | "NOT_ALLOWED" | "SIGNED_OUT" };

const locale = (v: FormDataEntryValue | null) => (v === "en" ? "en" : "es");
const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

/** Sign in with the email used to book and any booking code of that email. */
export async function signInWithCode(_prev: PortalState, form: FormData): Promise<PortalState> {
  const email = str(form.get("email")).toLowerCase();
  const code = str(form.get("code")).toUpperCase().replace(/\s+/g, "");
  const loc = locale(form.get("locale"));
  if (!z.string().email().max(254).safeParse(email).success || !/^(YMF-)?[A-Z0-9]{4,8}$/.test(code)) return { status: "error", error: "INVALID" };
  if (!(await allowRate(`portal-login:${await clientIp()}`, 10, 15 * 60_000))) return { status: "error", error: "RATE_LIMITED" };

  const booking = await db.booking.findUnique({ where: { code: code.startsWith("YMF-") ? code : `YMF-${code}` }, include: { customer: true } });
  if (!booking || booking.customer.email.toLowerCase() !== email) return { status: "error", error: "NO_MATCH" };
  await startClientSession(booking.customerId);
  redirect(`/${loc}/account`);
}

/**
 * From the private booking page (its link is the client's key to that
 * booking), open the portal without typing anything.
 */
export async function signInFromOrder(form: FormData): Promise<void> {
  const orderId = str(form.get("orderId"));
  const loc = locale(form.get("locale"));
  if (!/^c[a-z0-9]{20,32}$/.test(orderId)) redirect(`/${loc}/account`);
  const order = await db.order.findUnique({ where: { id: orderId }, select: { customerId: true } });
  if (order) await startClientSession(order.customerId);
  redirect(`/${loc}/account`);
}

export async function signOutClient(form: FormData): Promise<void> {
  await endClientSession();
  redirect(`/${locale(form.get("locale"))}/account`);
}

async function ownBooking(code: string) {
  const client = await currentClient();
  if (!client) return { error: "SIGNED_OUT" as const };
  const booking = await db.booking.findFirst({ where: { code, customerId: client.id } });
  if (!booking) return { error: "NOT_ALLOWED" as const };
  return { booking };
}

const linkSchema = z.string().trim().url().startsWith("https://").max(500);

/** The client shares the link to their files (WeTransfer, Google Drive, Dropbox…). */
export async function addClientFiles(_prev: PortalState, form: FormData): Promise<PortalState> {
  const code = str(form.get("code"));
  const url = linkSchema.safeParse(str(form.get("url")));
  const note = str(form.get("note")).slice(0, 1000);
  if (!url.success) return { status: "error", error: "URL" };
  const own = await ownBooking(code);
  if ("error" in own) return { status: "error", error: own.error };
  if (own.booking.bookingMode !== "DELIVERY" || ["CANCELLED", "EXPIRED", "COMPLETED", "PENDING"].includes(own.booking.status)) {
    return { status: "error", error: "NOT_ALLOWED" };
  }
  if (!(await allowRate(`portal-files:${own.booking.id}`, 20, 60 * 60_000))) return { status: "error", error: "RATE_LIMITED" };

  await db.projectLink.create({ data: { bookingId: own.booking.id, kind: "CLIENT_FILES", author: "client", url: url.data, note: note || null } });
  revalidatePath(`/${locale(form.get("locale"))}/account/${code}`);
  revalidatePath(`/dashboard/bookings/${own.booking.id}`);
  return { status: "ok", code: "FILES_SENT" };
}

/** After delivery, the client asks for changes. Extra revisions beyond the included ones add the fee to the balance. */
export async function requestRevision(_prev: PortalState, form: FormData): Promise<PortalState> {
  const code = str(form.get("code"));
  const note = str(form.get("note"));
  if (note.length < 5 || note.length > 3000) return { status: "error", error: "NOTE" };
  const own = await ownBooking(code);
  if ("error" in own) return { status: "error", error: own.error };
  if (!(await allowRate(`portal-revision:${own.booking.id}`, 5, 60 * 60_000))) return { status: "error", error: "RATE_LIMITED" };

  const r = await transitionBookingAs("client", own.booking.id, "REVISION", "Revisión solicitada por el cliente desde su portal");
  if (!r.ok) return { status: "error", error: "NOT_ALLOWED" };
  await db.projectLink.create({ data: { bookingId: own.booking.id, kind: "REVISION_REQUEST", author: "client", note } });
  revalidatePath(`/${locale(form.get("locale"))}/account/${code}`);
  revalidatePath(`/dashboard/bookings/${own.booking.id}`);
  return { status: "ok", code: r.feeNote ? "REVISION_REQUESTED_FEE" : "REVISION_REQUESTED" };
}
