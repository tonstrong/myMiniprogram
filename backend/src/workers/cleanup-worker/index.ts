import type { AppContext } from "../../app/bootstrap/app";

export async function runCleanupWorker(context: AppContext) {
  context.logger.info("Cleanup worker started (placeholder)");
}
