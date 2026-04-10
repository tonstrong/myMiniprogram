import { loadConfig } from "./app/config";
import { createAppContext } from "./app/bootstrap/app";
import { buildModuleRegistry } from "./app/bootstrap/modules";
import { buildHttpRoutes } from "./app/transport/http/routes";
import { startHttpServer } from "./app/transport/http/server";

async function start() {
  const config = loadConfig();
  const appContext = createAppContext(config);
  const modules = buildModuleRegistry();

  appContext.logger.info("Bootstrapping backend modules...");
  for (const module of modules) {
    await module.init(appContext);
    appContext.logger.info(`Module ready: ${module.name}`);
  }

  appContext.logger.info("Backend bootstrap completed.");

  const routes = buildHttpRoutes();
  await startHttpServer({ context: appContext, routes });
}

start().catch((error) => {
  console.error("Backend bootstrap failed", error);
  process.exit(1);
});
