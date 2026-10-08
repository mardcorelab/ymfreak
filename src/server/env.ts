import "server-only";
import { z } from "zod";

/**
 * Server environment, validated once at startup. Secrets are only readable
 * from server code (this module imports "server-only", so bundling it into the
 * browser fails the build). Variables for later phases are optional now and
 * become required as each phase is switched on.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().startsWith("postgres"),
  NEXT_PUBLIC_SITE_URL: z.string().url(),

  // Phase 2 — auth
  AUTH_SECRET: z.string().min(32).optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // Phase 4 — PayPal
  PAYPAL_ENV: z.enum(["sandbox", "live"]).default("sandbox"),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_WEBHOOK_ID: z.string().optional(),

  // Phase 5 — assistant
  ANTHROPIC_API_KEY: z.string().optional(),

  // Phase 7 — rate limiting / anti-spam
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`Invalid environment variables:\n${problems}`);
}

export const env = parsed.data;
