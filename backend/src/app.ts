import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import pinoHttp from "pino-http";
import type { Env } from "./config/env.js";
import { createLogger } from "./config/logger.js";
import { supabaseVerifier, type VerifyToken } from "./middleware/auth.js";
import { SupabaseGateway } from "./repositories/supabase.js";
import type { Gateway } from "./repositories/gateway.js";
import { Platform } from "./services/platform.js";
import { apiRouter } from "./routes/api.js";
import { AppError } from "./utils/errors.js";
import type { ContextRequest } from "./controllers/platform.js";
import swaggerUi from "swagger-ui-express";
import { openapi } from "./config/openapi.js";

export function createApp(
  env: Env,
  deps: {
    verifyToken?: VerifyToken;
    gateway?: (token: string, userId: string, requestId: string) => Gateway;
    ready?: () => Promise<boolean>;
    frontendDir?: string;
  } = {},
) {
  const app = express();
  const logger = createLogger(env.LOG_LEVEL);
  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          connectSrc: ["'self'", new URL(env.SUPABASE_URL).origin],
        },
      },
    }),
  );
  const allowed = env.FRONTEND_ORIGIN.split(",").map((x) => x.trim());
  app.use(
    cors({
      origin: (origin, callback) =>
        callback(
          origin && !allowed.includes(origin)
            ? new AppError(403, "CORS_DENIED", "Origin is not allowed.")
            : null,
          true,
        ),
      methods: ["GET", "POST", "PATCH", "DELETE"],
      allowedHeaders: ["Authorization", "Content-Type", "X-Request-Id"],
    }),
  );
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incoming = req.headers["x-request-id"];
        const id =
          typeof incoming === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(incoming)
            ? incoming
            : randomUUID();
        res.setHeader("X-Request-Id", id);
        return id;
      },
      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          path: typeof req.url === "string" ? req.url.split("?")[0] : undefined,
        }),
        res: (res) => ({ statusCode: res.statusCode }),
        err: () => ({ message: "Request failed" }),
      },
      customLogLevel: (_req, res) =>
        res.statusCode >= 500
          ? "error"
          : res.statusCode >= 400
            ? "warn"
            : "info",
    }),
  );
  app.use(express.json({ limit: "1100kb" }));
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Try again shortly.",
        },
      },
    }),
  );
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/ready", async (_req, res) => {
    let ok = false;
    try {
      ok = await (deps.ready?.() ?? Promise.resolve(false));
    } catch {
      /* Readiness reports failure without exposing configuration. */
    }
    res.status(ok ? 200 : 503).json({ status: ok ? "ready" : "not_ready" });
  });
  app.get("/api/openapi.json", (_req, res) => res.json(openapi));
  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(openapi, { customSiteTitle: "AlgoDeck API" }),
  );
  const verify = deps.verifyToken ?? supabaseVerifier(env);
  app.use("/api", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith("Bearer ") || header.length > 8192)
        throw new AppError(401, "UNAUTHORIZED", "Sign in to continue.");
      const token = header.slice(7);
      const userId = await verify(token);
      const requestId = String(req.id);
      const db =
        deps.gateway?.(token, userId, requestId) ??
        new SupabaseGateway(
          env.SUPABASE_URL,
          env.SUPABASE_PUBLIC_KEY,
          token,
          requestId,
          logger,
        );
      const context = req as ContextRequest;
      context.requestId = requestId;
      context.platform = new Platform(
        db,
        userId,
        requestId,
        logger.child({ user_id: userId, request_id: requestId }),
      );
      next();
    } catch (error) {
      logger.warn({ request_id: req.id }, "Authentication failed");
      next(error);
    }
  });
  app.use("/api", apiRouter());
  const frontendDir = deps.frontendDir;
  if (frontendDir) {
    app.use(express.static(frontendDir));
    app.get(["/", "/auth", "/app", "/app/{*path}"], (_req, res) =>
      res.sendFile("index.html", { root: frontendDir }),
    );
  }
  app.use((_req, res) =>
    res
      .status(404)
      .json({ error: { code: "NOT_FOUND", message: "Endpoint not found." } }),
  );
  app.use(
    (error: unknown, req: Request, res: Response, _next: NextFunction) => {
      if (error instanceof ZodError) {
        res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Check the provided fields.",
            details: error.issues.map((e) => ({
              field: e.path.join("."),
              message: e.message,
            })),
            request_id: req.id,
          },
        });
        return;
      }
      const known = error instanceof AppError ? error : null;
      const parseError =
        typeof error === "object" && error !== null && "type" in error
          ? String(error.type)
          : "";
      const status =
        known?.status ??
        (parseError === "entity.too.large"
          ? 413
          : parseError === "entity.parse.failed"
            ? 400
            : 500);
      if (status >= 500)
        logger.error(
          {
            request_id: req.id,
            error_type: error instanceof Error ? error.name : "unknown",
          },
          "Application request failed",
        );
      res.status(status).json({
        error: {
          code:
            known?.code ??
            (status === 413
              ? "PAYLOAD_TOO_LARGE"
              : status === 400
                ? "INVALID_JSON"
                : "INTERNAL_ERROR"),
          message:
            known?.message ??
            (status === 413
              ? "Import exceeds the upload limit."
              : status === 400
                ? "Invalid JSON request body."
                : "An unexpected error occurred. Please retry."),
          details: known?.details,
          request_id: req.id,
        },
      });
    },
  );
  return app;
}
