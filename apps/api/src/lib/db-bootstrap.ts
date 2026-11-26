import fs from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";

/**
 * Resolves the SQLite DATABASE_URL, defaulting to `apps/api/prisma/finflow.db`
 * when no URL is provided, and ensures the parent directory exists.
 */
export function resolveDatabaseUrl(explicitUrl?: string): string {
  const raw = explicitUrl ?? process.env.DATABASE_URL;
  const fallbackPath = path
    .resolve(import.meta.dirname, "../../prisma/finflow.db")
    .replace(/\\/g, "/");
  const url = raw && raw.trim().length > 0 ? raw.trim() : `file:${fallbackPath}`;

  if (url.startsWith("file:")) {
    const filePart = url.slice("file:".length).split("?")[0];
    if (filePart && filePart !== ":memory:") {
      const resolvedFile = path.isAbsolute(filePart)
        ? filePart
        : path.resolve(process.cwd(), filePart);
      fs.mkdirSync(path.dirname(resolvedFile), { recursive: true });
    }
  }

  return url;
}

function splitSqlStatements(sql: string): string[] {
  const withoutComments = sql
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

  return withoutComments
    .split(";")
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0)
    .map((stmt) =>
      stmt
        .replace(/^CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/i, "CREATE TABLE IF NOT EXISTS ")
        .replace(
          /^CREATE\s+UNIQUE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/i,
          "CREATE UNIQUE INDEX IF NOT EXISTS "
        )
        .replace(/^CREATE\s+INDEX\s+(?!IF\s+NOT\s+EXISTS)/i, "CREATE INDEX IF NOT EXISTS ")
    );
}

/**
 * Idempotently applies all Prisma SQLite migrations on startup so the API
 * never fails on a fresh or unmigrated database file.
 */
export async function ensureDatabaseSchema(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON;");
  await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");

  const migrationsDir = path.resolve(import.meta.dirname, "../../prisma/migrations");
  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  const migrationFolders = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  for (const folder of migrationFolders) {
    const sqlPath = path.join(migrationsDir, folder, "migration.sql");
    if (!fs.existsSync(sqlPath)) continue;

    const sql = fs.readFileSync(sqlPath, "utf8");
    const statements = splitSqlStatements(sql);

    for (const stmt of statements) {
      try {
        await prisma.$executeRawUnsafe(stmt);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.toLowerCase().includes("duplicate column name")) {
          continue;
        }
        throw err;
      }
    }
  }
}
