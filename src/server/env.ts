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

  // Phase 2 — admin sign-in (dashboard is disabled until both are set)
  // Kept lenient on purpose: a bad admin value must disable the dashboard,
  // never take the public site down. src/server/auth/admin.ts checks them.
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  /** Optional: signs sessions; derived from ADMIN_PASSWORD when not set. */
  AUTH_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  /** Optional: where owner alerts go (defaults to ADMIN_EMAIL). */
  ALERT_EMAIL: z.string().optional(),

  // Phase 4 — PayPal
  PAYPAL_ENV: z.enum(["sandbox", "live"]).default("sandbox"),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_WEBHOOK_ID: z.string().optional(),

  // Phase 5 — assistant
  ANTHROPIC_API_KEY: z.string().optional(),
  /** Optional: Claude model id for the assistant (defaults in src/server/agent/model.ts). */
  ANTHROPIC_MODEL: z.string().optional(),

  /** Optional: YouTube Data API key, to show real view counts of the releases. */
  YOUTUBE_API_KEY: z.string().optional(),
  /** Optional: ElevenLabs, for voice notes and replies in YM Freak's cloned voice. */
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().optional(),
  ELEVENLABS_TTS_MODEL: z.string().optional(),
  ELEVENLABS_STT_MODEL: z.string().optional(),
  /** Optional: song.link API key, to find releases on every platform automatically. */
  SONGLINK_API_KEY: z.string().optional(),

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
