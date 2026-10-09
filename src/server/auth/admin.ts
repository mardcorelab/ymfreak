import "server-only";
import { cookies, draftMode, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "../db";
import { env } from "../env";
import {
  createSessionToken,
  safeEqual,
  secretMaterial,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  verifySessionToken,
  type SessionPayload,
} from "./session";

export const MIN_PASSWORD_LENGTH = 12;
const MAX_FAILURES = 8;
const WINDOW_MS = 15 * 60 * 1000;

export type AdminConfig =
  | { ok: true; email: string; password: string }
  | { ok: false; reason: "MISSING" | "WEAK_PASSWORD" | "BAD_EMAIL" };

export function adminConfig(): AdminConfig {
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.ADMIN_PASSWORD;
  if (!email || !password) return { ok: false, reason: "MISSING" };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, reason: "BAD_EMAIL" };
  if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, reason: "WEAK_PASSWORD" };
  return { ok: true, email, password };
}

function material(): string | null {
  return adminConfig().ok ? secretMaterial(env) : null;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown").slice(0, 64);
}

export async function isRateLimited(ip: string): Promise<boolean> {
  const failures = await db.loginAttempt.count({
    where: { ip, success: false, createdAt: { gte: new Date(Date.now() - WINDOW_MS) } },
  });
  return failures >= MAX_FAILURES;
}

export type SignInResult = { ok: true } | { ok: false; reason: "NOT_CONFIGURED" | "INVALID" | "RATE_LIMITED" };

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const config = adminConfig();
  const key = material();
  if (!config.ok || !key) return { ok: false, reason: "NOT_CONFIGURED" };

  const ip = await clientIp();
  if (await isRateLimited(ip)) return { ok: false, reason: "RATE_LIMITED" };

  // Both comparisons always run, so timing does not reveal which one failed.
  const [emailOk, passwordOk] = await Promise.all([
    safeEqual(email.trim().toLowerCase(), config.email),
    safeEqual(password, config.password),
  ]);
  const success = emailOk && passwordOk;
  await db.loginAttempt.create({ data: { ip, success } });
  if (!success) return { ok: false, reason: "INVALID" };

  const token = await createSessionToken(config.email, key);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  // Lets the owner see the real site while it's hidden from the public (see site-visibility.ts).
  (await draftMode()).enable();
  await audit("admin.sign_in", "session", null, { ip });
  return { ok: true };
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  (await draftMode()).disable();
}

export async function currentAdmin(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token, material());
}

/**
 * Call at the top of every admin page and server action. The middleware
 * redirect is a convenience; this check is the real gate.
 */
export async function requireAdmin(): Promise<SessionPayload> {
  const admin = await currentAdmin();
  if (!admin) redirect("/dashboard/login");
  return admin;
}

export async function audit(action: string, entity: string, entityId: string | null, data?: unknown): Promise<void> {
  await db.auditLog.create({
    data: { actorId: "admin", action, entity, entityId, data: data === undefined ? undefined : JSON.parse(JSON.stringify(data)) },
  });
}
