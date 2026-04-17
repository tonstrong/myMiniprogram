import { loadConfig } from "../app/config";
import { createAppContext } from "../app/bootstrap/app";
import { buildModuleRegistry } from "../app/bootstrap/modules";
import { runRecommendationWorker } from "./recommendation-worker";

async function start() {
  const config = loadConfig();
  const appContext = createAppContext(config);
  const modules = buildModuleRegistry();

  appContext.logger.info("Bootstrapping worker modules...");
  for (const module of modules) {
    await module.init(appContext);
  }

  await runRecommendationWorker(appContext);
}

start().catch((error) => {
  console.error("Worker bootstrap failed", error);
  process.exit(1);
});
