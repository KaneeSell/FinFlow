import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "./db-bootstrap.js";

export function createPrismaClient(databaseUrl?: string): PrismaClient {
  const url = resolveDatabaseUrl(databaseUrl);
  return new PrismaClient({
    datasources: {
      db: { url },
    },
  });
}
