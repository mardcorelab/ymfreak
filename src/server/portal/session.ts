import "server-only";
import { cookies } from "next/headers";
import type { Customer } from "@prisma/client";
import { db } from "../db";
import { env } from "../env";
import { CLIENT_COOKIE, CLIENT_SESSION_DAYS, clientKey, createClientToken, verifyClientToken } from "../auth/client-token";

const key = () => clientKey({ AUTH_SECRET: env.AUTH_SECRET, DATABASE_URL: env.DATABASE_URL });

/** The signed-in client, or null. Customers are matched by id; a deleted customer signs out. */
export async function currentClient(): Promise<Customer | null> {
  const jar = await cookies();
  const payload = verifyClientToken(jar.get(CLIENT_COOKIE)?.value, key());
  if (!payload) return null;
  return db.customer.findUnique({ where: { id: payload.cid } });
}

export async function startClientSession(customerId: string): Promise<void> {
  const k = key();
  if (!k) throw new Error("No key for client sessions");
  const jar = await cookies();
  jar.set(CLIENT_COOKIE, createClientToken(customerId, k), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: CLIENT_SESSION_DAYS * 86400,
  });
}

export async function endClientSession(): Promise<void> {
  (await cookies()).delete(CLIENT_COOKIE);
}
