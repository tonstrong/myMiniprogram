import { spawn } from "child_process";

const children = [];
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function startProcess(name, scriptName) {
  const child = spawn(npmCommand, ["run", scriptName], {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false
  });

  child.on("exit", (code, signal) => {
    const normalizedCode = typeof code === "number" ? code : 0;
    const isIntentionalShutdown = shuttingDown;

    if (!isIntentionalShutdown && normalizedCode !== 0) {
      console.error(`[dev:all] ${name} exited unexpectedly`, {
        code,
        signal
      });
      shutdown(normalizedCode || 1);
      return;
    }

    if (!isIntentionalShutdown && signal) {
      console.error(`[dev:all] ${name} stopped by signal ${signal}`);
      shutdown(1);
    }
  });

  children.push(child);
  return child;
}

function terminateChild(child) {
  if (!child || child.killed) {
    return;
  }

  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore"
    });
    killer.on("error", () => {
      child.kill();
    });
    return;
  }

  child.kill("SIGTERM");
}

let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  children.forEach(terminateChild);

  setTimeout(() => {
    process.exit(exitCode);
  }, 300);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log("[dev:all] starting API and worker...");
startProcess("api", "dev");
startProcess("worker", "worker");
