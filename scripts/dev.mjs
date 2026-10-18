import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const port = Number(process.env.DEV_API_PORT || 4322);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("DEV_API_PORT must be a valid TCP port");
}
const astroCli = fileURLToPath(new URL("../node_modules/astro/bin/astro.mjs", import.meta.url));

const children = new Set();
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
  }

  const forceStop = setTimeout(() => {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }
  }, 3000);
  forceStop.unref();
}
function launch(command, args, env) {
  const child = spawn(command, args, { stdio: "inherit", env });
  children.add(child);
  child.on("error", (error) => {
    children.delete(child);
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (!stopping) stop(signal ? 1 : code || 0);
  });
  return child;
}

process.once("SIGINT", () => stop(130));
process.once("SIGTERM", () => stop(143));
const api = launch(process.execPath, ["server.js"], { ...process.env, PORT: String(port) });
let ready = false;
for (let attempt = 0; attempt < 40 && !stopping; attempt++) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/analytics.js`, { signal: AbortSignal.timeout(500) });
    if (response.ok) { ready = true; break; }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 100));
}
if (!ready && !stopping) {
  console.error("Development API server did not start");
  stop(1);
} else if (!stopping) {
  launch(process.execPath, [astroCli, "dev", "--ignore-lock", "--host", "0.0.0.0", ...process.argv.slice(2)], {
    ...process.env,
    DEV_API_PORT: String(port),
  });
}
await Promise.all([...children].map((child) => once(child, "exit").catch(() => {})));
