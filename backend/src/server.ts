import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { createLogger } from "./config/logger.js";
const env = loadEnv();
const logger = createLogger(env.LOG_LEVEL);
const publicDb = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLIC_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const frontendDir = resolve("frontend/dist");
const app = createApp(env, {
  ...(env.NODE_ENV === "production" &&
  existsSync(resolve(frontendDir, "index.html"))
    ? { frontendDir }
    : {}),
  ready: async () => {
    const { data, error } = await publicDb.rpc("application_ready");
    return !error && data === true;
  },
});
const server = app.listen(env.PORT, () =>
  logger.info({ port: env.PORT }, "AlgoDeck API listening"),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    logger.info({ signal }, "Shutting down");
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  });
