# Security and logging

All API user IDs derive from Supabase Auth verification. Each request creates a Supabase client with the user's bearer token and the public project key. PostgREST parameterizes filters and SQL RPC arguments; there are no concatenated user SQL queries. Ownership reads return 404 for inaccessible resources.

RLS protects all seven tables. Composite ownership foreign keys prevent attaching a user's question to another user's collection/session. Ordinary authenticated clients can insert/edit their own collections/questions but cannot write progress, sessions, attempts or audit records directly. The narrowly scoped SECURITY DEFINER functions use fixed search paths, explicit auth.uid ownership checks and grants only to authenticated. They never disable RLS. Their privileged internal writes are contained within the checked transaction. Attempts cannot be edited/deleted by application roles. [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).

Zod validates body, used query parameters, UUIDs, timezones, URLs, field lengths and numeric bounds. Imports limit HTTP body size, content bytes and row count. External question links allow only HTTP/HTTPS. CSV is parsed as text; imported content and notes render through React escaping, with no HTML injection.

Helmet applies security headers; CORS permits configured origins only. API rate limiting is per process/IP. Supabase Auth handles login/registration limits; configure project email/provider limits. Run behind HTTPS, keep `TRUST_PROXY=0` unless deploying behind a known proxy chain, and set the correct proxy count. Horizontal deployments need a shared rate-limit store or edge throttling.

Browser sessions use official Supabase storage/refresh handling. This SPA uses local browser storage, not custom cookies. Protect the frontend origin against XSS, use the provided safe rendering, and never expose privileged credentials. Session caches clear at logout.

Pino writes JSON to stdout. HTTP logs serialize only ID/method/path/status/duration, strip query strings, and do not serialize authorization headers or response bodies. Database errors log only safe database codes. Unexpected exceptions omit payloads and stack traces from client responses. Request IDs are validated or generated and returned in headers. Scheduling logs record counts and safe IDs. No question content, notes, passwords, tokens or connection strings are logged.

Database audit records persist meaningful collection/question mutations, imports, sessions, ratings and completion. They store safe event types/IDs/counts, never content or notes. Operational stdout logs are **not** persistently stored by this app. Development can pipe JSON to a formatter; deployment platforms may retain stdout according to their settings. For centralized observability, configure a platform log drain/agent to your chosen service, with retention and access controls. Audit records are distinct from that sink.

Run `npm audit` and `npm run security` when dependencies change. The committed lockfile makes installations reproducible. `.env` files and CLI metadata are ignored by Git.
