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
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    const [rows] = await client.query<Array<{ filename: string }>>(
      `SELECT filename FROM ${migrationTable} ORDER BY filename ASC;`
    );
    return new Set(rows.map((row) => row.filename));
  });
}

async function run(): Promise<void> {
  await ensureMigrationTable();

  const migrationFiles = await loadMigrationFiles();
  const applied = await loadAppliedMigrations();
  const pending = migrationFiles.filter((file) => !applied.has(file.filename));

  if (pending.length === 0) {
    // eslint-disable-next-line no-console
    console.log("[migrate] No pending migrations.");
    return;
  }

  await withClient(async (client) => {
    for (const migration of pending) {
      const sql = await fs.readFile(migration.fullPath, "utf-8");
      // eslint-disable-next-line no-console
      console.log(`[migrate] Applying ${migration.filename}`);
      await client.query(sql);
      await client.query(
        `INSERT INTO ${migrationTable} (filename) VALUES (?)`,
        [migration.filename]
      );
    }
  });
}

run()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("[migrate] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
