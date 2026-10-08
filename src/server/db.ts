import "server-only";
import { PrismaClient } from "@prisma/client";
import { env } from "./env";

// One client per server instance; reused across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;
