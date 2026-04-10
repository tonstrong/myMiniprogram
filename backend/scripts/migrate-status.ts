import { promises as fs } from "fs";
import path from "path";
import { closePool, withClient } from "../src/app/db";

const migrationDir = path.resolve(__dirname, "..", "migrations");
const migrationTable = "schema_migrations";

interface MigrationFile {
  filename: string;
  fullPath: string;
}

async function ensureMigrationTable(): Promise<void> {
  await withClient(async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${migrationTable} (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  });
}

async function loadMigrationFiles(): Promise<MigrationFile[]> {
  const entries = await fs.readdir(migrationDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .filter((entry) => /^\d+.*\.sql$/.test(entry.name))
    .map((entry) => ({
      filename: entry.name,
      fullPath: path.join(migrationDir, entry.name)
    }))
    .sort((a, b) => a.filename.localeCompare(b.filename));
}

async function loadAppliedMigrations(): Promise<Set<string>> {
  return withClient(async (client) => {
    const result = await client.query<{ filename: string; applied_at: string }>(
      `SELECT filename, applied_at FROM ${migrationTable} ORDER BY filename ASC;`
    );

    if (result.rows.length > 0) {
      // eslint-disable-next-line no-console
      console.log("[migrate:status] Applied migrations:");
      for (const row of result.rows) {
        // eslint-disable-next-line no-console
        console.log(`  ✔ ${row.filename} (${row.applied_at})`);
      }
    } else {
      // eslint-disable-next-line no-console
      console.log("[migrate:status] No applied migrations yet.");
    }

    return new Set(result.rows.map((row) => row.filename));
  });
}

async function run(): Promise<void> {
  await ensureMigrationTable();

  const migrationFiles = await loadMigrationFiles();
  const applied = await loadAppliedMigrations();
  const pending = migrationFiles.filter((file) => !applied.has(file.filename));

  if (pending.length > 0) {
    // eslint-disable-next-line no-console
    console.log("[migrate:status] Pending migrations:");
    for (const migration of pending) {
      // eslint-disable-next-line no-console
      console.log(`  ○ ${migration.filename}`);
    }
  }
}

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("[migrate:status] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
