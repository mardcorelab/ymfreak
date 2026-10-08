/**
 * Admin session tokens, signed with HMAC-SHA256 through Web Crypto so the
 * same code runs in the middleware (edge) and on the server (Node).
 *
 * Token = base64url(payload JSON) + "." + base64url(HMAC(payload)).
 * The signing key comes from AUTH_SECRET when set; otherwise it is derived
 * from ADMIN_PASSWORD + DATABASE_URL, so changing the admin password signs
 * everyone out automatically and no extra secret has to be configured.
 */

export const SESSION_COOKIE = "ymf_admin";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export interface SessionPayload {
  sub: "admin";
  email: string;
  iat: number;
  exp: number;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export interface SecretSource {
  AUTH_SECRET?: string | undefined;
  ADMIN_PASSWORD?: string | undefined;
  DATABASE_URL?: string | undefined;
}

/** Returns null when admin login is not configured (no password set). */
export function secretMaterial(env: SecretSource): string | null {
  if (env.AUTH_SECRET && env.AUTH_SECRET.length >= 32) return env.AUTH_SECRET;
  if (!env.ADMIN_PASSWORD) return null;
  return `ymfreak-admin-session:${env.ADMIN_PASSWORD}:${env.DATABASE_URL ?? ""}`;
}

async function hmacKey(material: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(material));
  return crypto.subtle.importKey("raw", digest, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createSessionToken(email: string, material: string, now = Date.now()): Promise<string> {
  const iat = Math.floor(now / 1000);
  const payload: SessionPayload = { sub: "admin", email, iat, exp: iat + SESSION_MAX_AGE_SECONDS };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(material), encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
  material: string | null,
  now = Date.now(),
): Promise<SessionPayload | null> {
  if (!token || !material) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [body, signature] = parts as [string, string];

  let valid = false;
  try {
    // crypto.subtle.verify compares in constant time.
    valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(material),
      fromBase64Url(signature),
      encoder.encode(body),
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as Partial<SessionPayload>;
    if (payload.sub !== "admin" || typeof payload.email !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 <= now) return null;
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

/** Constant-time equality for two strings (compares SHA-256 digests). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const x = new Uint8Array(da);
  const y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
