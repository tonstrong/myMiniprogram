/*
 * Placeholder migration status command.
 * Implement once a DB driver + migration table are in place.
 */

const migrationDir = "migrations";

async function run(): Promise<void> {
  // TODO: read applied migrations from DB and compare with migrationDir.
  // eslint-disable-next-line no-console
  console.log(
    `[migrate:status] Placeholder status. Check applied vs ${migrationDir}.`
  );
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[migrate:status] failed", error);
  process.exitCode = 1;
});
