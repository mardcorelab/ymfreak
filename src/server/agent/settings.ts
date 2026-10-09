import "server-only";
import { cache } from "react";
import { db } from "../db";
import { agentSettingsSchema } from "../settings/schemas";

export type AgentSettings = { name: string; notes: string };
const DEFAULTS: AgentSettings = { name: "", notes: "" };

/** Name and owner's guidance for the assistant (editable in the dashboard). Never throws. */
export const getAgentSettings = cache(async (): Promise<AgentSettings> => {
  try {
    const row = await db.setting.findUnique({ where: { key: "agent" } });
    const parsed = row ? agentSettingsSchema.safeParse(row.value) : null;
    return parsed?.success ? parsed.data : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
});
