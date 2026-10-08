import "server-only";
import { cache } from "react";
import { db } from "../db";
import { parseSetting, type SettingKey, type SettingValue } from "./schemas";

/** Reads and validates a setting. Cached per request. */
export const getSetting = cache(async <K extends SettingKey>(key: K): Promise<SettingValue<K>> => {
  const row = await db.setting.findUnique({ where: { key } });
  if (!row) throw new Error(`Missing setting "${key}". Run npm run db:seed.`);
  return parseSetting(key, row.value);
});
