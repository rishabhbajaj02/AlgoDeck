# Deployment

The current deployment target is [Azure App Service](azure-app-service.md). In production, Express also serves `frontend/dist` when that directory is present. The API and frontend can alternatively run separately with the container files.

The earlier [AKS demo guide](azure-kubernetes.md) remains available for learning. Its temporary cluster was removed when the user switched to App Service. A $5 budget cannot support a continuously running AKS cluster.

## Build

```sh
npm ci
npm run build
```

API start: `npm start -w backend`, with Node 24 LTS. Ship the backend build, shared workspace build, production node_modules and workspace package manifests. A container example is provided in Dockerfile. The service must permit outbound HTTPS to Supabase. Set `NODE_ENV=production`, `PORT`, `SUPABASE_URL`, `SUPABASE_PUBLIC_KEY`, `FRONTEND_ORIGIN`, `LOG_LEVEL`, and the correct `TRUST_PROXY` value.

Frontend build variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLIC_KEY`, and `VITE_API_URL` (the API origin, without `/api`). Vite embeds them at build time. If Express serves the frontend, leave `VITE_API_URL` empty; its `/api` routes and SPA deep links are handled directly. A separate static host needs SPA fallback and an API origin or proxy. Preserve `/api/docs` and `/api/openapi.json` routes.

Use Supabase CLI `db push` to apply committed migrations before releasing the app. Back up a populated database before schema updates. Never use `db reset` on a hosted project. No duplicate backend migration directory exists.

## Deployment checklist

For the current Azure Free-tier deployment, follow [Azure App Service](azure-app-service.md). Its single Node process also serves the compiled frontend.

- [ ] Supabase migration applied; RLS/grants remain enabled.
- [ ] Supabase Auth production site/redirect URLs, email provider and sign-up settings configured.
- [ ] HTTPS configured for frontend and API.
- [ ] CORS origin and trusted proxy count match the deployment.
- [ ] Public frontend variables and server variables configured separately; no service-role secrets shipped.
- [ ] Liveness `/api/health` and readiness `/api/ready` probes configured.
- [ ] Tests, build, strict checks and dependency audit pass.
- [ ] Real two-account smoke test completed using a development/staging project.
- [ ] Platform stdout retention or centralized log drain configured and verified.
- [ ] Supabase backups/retention configured; account-deletion history policy decided.
- [ ] Rate limiting coordinated across replicas or at the edge.

## Operational limits

The MVP paginates database reads in batches of 500 and API question/history/queue results, but calculates analytics and eligibility from all caller-owned records in the API. Question facets count the entire collection independently of result pagination, and queue status filtering occurs before pagination. For large accounts, move aggregation and candidate filtering into indexed SQL functions. These are documented scaling limits, not artificial caps on persisted data.

Graceful shutdown drains connections for up to 10 seconds. The readiness check checks REST reachability/schema exposure. It does not claim full user authentication, email delivery or access to every RPC. Browser session storage requires a secure frontend origin.
