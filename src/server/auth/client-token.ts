/**
 * Client portal session tokens: base64url(payload).base64url(HMAC-SHA256).
 * Pure Node crypto, no database, unit-tested. The key is derived from
 * AUTH_SECRET (or the database URL, which is always secret), with its own
 * label so a client token can never be used as an admin token.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const CLIENT_COOKIE = "ymf_client";
export const CLIENT_SESSION_DAYS = 30;

export interface ClientTokenPayload {
  sub: "client";
  cid: string;
  iat: number;
  exp: number;
}

export function clientKey(env: { AUTH_SECRET?: string | undefined; DATABASE_URL?: string | undefined }): string | null {
  const base = env.AUTH_SECRET && env.AUTH_SECRET.length >= 32 ? env.AUTH_SECRET : env.DATABASE_URL;
  return base ? `ymfreak-client-session:${base}` : null;
}

const b64 = (b: Buffer) => b.toString("base64url");
const sign = (body: string, key: string) => createHmac("sha256", key).update(body).digest();

export function createClientToken(customerId: string, key: string, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const payload: ClientTokenPayload = { sub: "client", cid: customerId, iat, exp: iat + CLIENT_SESSION_DAYS * 86400 };
  const body = b64(Buffer.from(JSON.stringify(payload)));
  return `${body}.${b64(sign(body, key))}`;
}

export function verifyClientToken(token: string | undefined | null, key: string | null, now = Date.now()): ClientTokenPayload | null {
  if (!token || !key) return null;
  const [body, sig, extra] = token.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const expected = sign(body, key);
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<ClientTokenPayload>;
    if (p.sub !== "client" || typeof p.cid !== "string" || typeof p.exp !== "number" || p.exp * 1000 <= now) return null;
    return p as ClientTokenPayload;
  } catch {
    return null;
  }
}
