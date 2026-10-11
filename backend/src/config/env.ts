import { z } from "zod";
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  FRONTEND_ORIGIN: z.string().default("http://localhost:5173"),
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLIC_KEY: z.string().min(20),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
});
export type Env = z.infer<typeof schema>;
export function loadEnv(): Env {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    process.stderr.write(
      `Invalid configuration: ${result.error.issues.map((x) => x.path.join(".")).join(", ")}. Copy backend/.env.example to backend/.env.\n`,
    );
    process.exit(1);
  }
  return result.data;
}
