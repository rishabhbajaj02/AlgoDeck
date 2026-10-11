import pino from "pino";
export function createLogger(level = "info") {
  return pino({
    level,
    redact: {
      paths: [
        "req.headers",
        "res.headers",
        "password",
        "token",
        "access_token",
        "refresh_token",
        "authorization",
        "cookie",
        "notes",
        "content",
        "SUPABASE_PUBLIC_KEY",
        "DATABASE_URL",
      ],
      remove: true,
    },
    serializers: { err: () => ({ message: "Unexpected application failure" }) },
  });
}
