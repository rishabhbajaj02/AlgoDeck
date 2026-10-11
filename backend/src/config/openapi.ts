const uuid = { type: "string", format: "uuid" };
const response = (description: string) => ({
  description,
  content: { "application/json": { schema: { type: "object" } } },
});
const idParameter = { name: "id", in: "path", required: true, schema: uuid };
const question = {
  type: "object",
  required: ["title"],
  additionalProperties: false,
  properties: {
    title: { type: "string", maxLength: 200 },
    content: { type: "string", maxLength: 20000 },
    category: { type: "string" },
    pattern: { type: "string" },
    source_url: { type: "string", format: "uri", nullable: true },
    metadata: { type: "object" },
  },
};
const collection = {
  type: "object",
  required: ["name"],
  additionalProperties: false,
  properties: {
    name: { type: "string", maxLength: 120 },
    description: { type: "string" },
    daily_target: { type: "integer", minimum: 1, maximum: 50, default: 5 },
    new_question_limit: {
      type: "integer",
      minimum: 0,
      maximum: 50,
      default: 3,
    },
    archived_at: { type: "string", format: "date-time", nullable: true },
    review_policy: {
      type: "object",
      properties: Object.fromEntries(
        ["easy", "medium", "hard"].map((x) => [
          x,
          {
            type: "array",
            items: { type: "integer", minimum: 1, maximum: 365 },
          },
        ]),
      ),
    },
  },
};
const body = (schema: unknown) => ({
  required: true,
  content: { "application/json": { schema } },
});
const op = (summary: string, schema?: unknown, extra: unknown[] = []) => ({
  summary,
  security: [{ bearerAuth: [] }],
  parameters: [...extra],
  ...(schema ? { requestBody: body(schema) } : {}),
  responses: {
    200: response("Success"),
    400: response("Validation error"),
    401: response("Unauthorized"),
    404: response("Not found"),
    409: response("Conflict"),
    422: response("Import row errors"),
    503: response("Database unavailable"),
  },
});
export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "AlgoDeck API",
    version: "1.0.0",
    description:
      "Supabase Auth bearer tokens. Dates derive from the timezone parameter. Resource ownership always derives from the verified token.",
  },
  servers: [{ url: "/api" }],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
    schemas: {
      CollectionInput: collection,
      QuestionInput: question,
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: {},
              request_id: { type: "string" },
            },
          },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: { summary: "Liveness", responses: { 200: response("Alive") } },
    },
    "/ready": {
      get: {
        summary: "Database/API schema readiness",
        responses: { 200: response("Ready"), 503: response("Not ready") },
      },
    },
    "/collections": {
      get: op("List collections"),
      post: {
        ...op("Create collection", collection),
        responses: {
          201: response("Created"),
          400: response("Invalid input"),
          401: response("Unauthorized"),
        },
      },
    },
    "/collections/{id}": {
      get: op("Get collection", undefined, [idParameter]),
      patch: op("Edit or archive collection", { ...collection, required: [] }, [
        idParameter,
      ]),
      delete: {
        ...op("Delete collection without practice history", undefined, [
          idParameter,
        ]),
        responses: {
          204: { description: "Deleted" },
          409: response("Archive collections with history instead"),
        },
      },
    },
    "/collections/{id}/questions": {
      get: op("Search and paginate questions", undefined, [
        idParameter,
        ...[
          "page",
          "page_size",
          "search",
          "category",
          "pattern",
          "status",
          "timezone",
        ].map((name) => ({ name, in: "query", schema: { type: "string" } })),
      ]),
      post: {
        ...op("Add question", question, [idParameter]),
        responses: { 201: response("Created") },
      },
    },
    "/questions/{id}": {
      get: op("Get question and progress", undefined, [idParameter]),
      patch: op("Edit question", { ...question, required: [] }, [idParameter]),
      delete: {
        ...op("Archive question and preserve history", undefined, [
          idParameter,
        ]),
        responses: { 204: { description: "Archived" } },
      },
    },
    "/collections/{id}/import": {
      post: op(
        "Atomic CSV/JSON import; 1 MB, 1000 rows",
        {
          type: "object",
          required: ["format", "content"],
          properties: {
            format: { type: "string", enum: ["csv", "json"] },
            content: { type: "string" },
          },
        },
        [idParameter],
      ),
    },
    "/collections/{id}/export": {
      get: op("Export importable JSON", undefined, [idParameter]),
    },
    "/collections/{id}/sessions": {
      post: op(
        "Create or return timezone-local daily session",
        {
          type: "object",
          properties: { timezone: { type: "string", default: "UTC" } },
        },
        [idParameter],
      ),
    },
    "/sessions/{id}": {
      get: op("Get persisted session", undefined, [idParameter]),
    },
    "/sessions/{id}/questions/{questionId}/rate": {
      post: op(
        "Atomic idempotent rating; altered retries conflict",
        {
          type: "object",
          required: ["rating"],
          properties: {
            rating: { type: "string", enum: ["easy", "medium", "hard"] },
            notes: { type: "string", maxLength: 4000, nullable: true },
            time_spent_seconds: {
              type: "integer",
              minimum: 0,
              maximum: 86400,
              nullable: true,
            },
          },
        },
        [
          idParameter,
          { name: "questionId", in: "path", required: true, schema: uuid },
        ],
      ),
    },
    "/sessions/{id}/complete": {
      post: op(
        "Complete fully rated session",
        { type: "object", additionalProperties: false },
        [idParameter],
      ),
    },
    "/collections/{id}/revision-queue": {
      get: op("Paginated review reasons and priorities", undefined, [
        idParameter,
      ]),
    },
    "/questions/{id}/history": {
      get: op("Paginated immutable attempts", undefined, [idParameter]),
    },
    "/dashboard": { get: op("Dashboard statistics in study timezone") },
    "/collections/{id}/analytics": {
      get: op(
        "Trends, difficulty, categories, patterns and workload",
        undefined,
        [idParameter],
      ),
    },
  },
};
