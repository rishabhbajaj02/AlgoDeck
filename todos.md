# AlgoDeck implementation tracker

Source of requirements: `prompt.txt`. Updated as each phase is verified.

- [x] Phase 1: Inspect empty repository and define architecture.
- [x] Phase 1: Establish TypeScript npm workspaces and development scripts.
- [x] Phase 2: Supabase migrations, ownership constraints, RLS, transactional RPCs, authentication.
- [x] Phase 3: Scheduler, import validation, persistence layer, REST API, analytics.
- [x] Phase 4: Responsive React pages connected to the API.
- [x] Phase 5: Safe structured logging, security, seed data, meaningful automated tests.
- [x] Phase 6: Build, strict TypeScript checks, unit/integration/frontend tests and dependency audit.
- [x] Phase 7: README, OpenAPI, deployment and troubleshooting documentation.
- [x] Documentation follow-up: Expand project README with architecture, configuration, import formats, verification and current Azure hosting. Checked all 16 local links, CSV/JSON examples against the importer and documented root commands against package.json.
- [x] User setup: Configure existing Supabase project URL and public key; apply migration.
- [x] User setup: Identify and apply Ponytail 5.1.0.
- [x] Live verification: Supabase sign-in/restoration, collection import/edit, persisted practice, rating/history and analytics.
- [x] Azure deployment: Prepare frontend/backend containers and AKS manifests; Kustomize renders successfully.
- [x] Azure deployment: Confirm temporary demo/cleanup agreement, Azure CLI sign-in, subscription Owner role, East US quota and small-node price.
- [x] Azure Kubernetes cleanup: First cluster provisioned; connection failed through default DNS. Demo and managed node resource groups both verified absent. User switched deployment target to App Service before retry.

## Decisions and evidence

- Use Supabase REST with the caller's verified JWT; no service-role key required by the app.
- RLS plus ownership checks protect all resources. Privileged transactional functions check auth.uid explicitly and have fixed search paths.
- Session creation and rating transactions serialize writes and provide idempotency.
- Keep canonical migrations in supabase/migrations only.
- Preserve attempt history: archive questions; collections with history must be archived instead of physically deleted.
- Use browser timezone for the study day. Yesterday's session selections are excluded regardless of rating.
- Migration/RLS tests use isolated embedded PostgreSQL (PGlite). Both container images built and ran successfully with non-root users, read-only filesystems and dropped capabilities. API/Supabase readiness, SPA fallback, proxy and unauthenticated rejection verified.
- Existing project configured in ignored .env files. CLI project ref verified; migrations 202610110001 and 202610110002 applied successfully without resetting data.
- User's prompt explicitly asks to begin implementation and make sensible decisions; execute the written plan inline without additional design approval rounds.
- Final verification: build passed without oversized chunk warnings, strict TypeScript checks passed, 25 backend/database + 12 API integration + 7 frontend tests passed (44 total). Production dependency audit reports zero vulnerabilities.
- Dependency audit: upgraded csv-parse to 7.0.3 and Vitest to 5.0.3; npm installation reported zero vulnerabilities.
- Windows sandbox blocks localhost HTTP tests and Vitest shared temporary modules. Full suite passes outside sandbox without disabling assertions or tests.
- Final refinements verified: collection-wide facet counts, server-side queue filtering, lazy routes/vendor chunks, hosted readiness and mobile/desktop UI.
- Final review identified and reproduced reverse-date consecutive selection, rating/eligibility locking, and uncertain rating retries; fixes added with regression coverage and follow-up migration 202610110002.
- User expanded scope to Azure Kubernetes deployment after local verification. Azure CLI is installed outside the inherited PATH; kubectl and Docker are installed. Explicit CLI path is used for deployment.
- User supplied subscription and a $5 maximum budget, then explicitly approved a temporary demo and deletion afterward. Azure CLI 2.91 signed in; subscription enabled, Owner role and DSv5 quota 20 cores verified.
- Automatic approval review rejected Microsoft.ContainerRegistry registration as a subscription-wide change. User then explicitly approved provider registration; registration completed. Temporary resource creation started, with the two-hour deadline recorded in ignored .deploy/azure-demo.json.
- Compiled production backend started on a temporary port; health and hosted readiness returned ok/ready, then graceful shutdown verified.
- Hosted demo collection contains 12 questions and a completed five-question session. Reload preserved completion; Hard/Medium/Easy dates are Oct 12/14/18, notes and attempt history persisted, analytics show 5 attempts and 60% success. Proof saved in docs/screenshots/practice-complete.jpg.
- Real two-account hosted isolation, email delivery and production load tests remain separate checks; isolated two-user authorization/RLS tests pass.


- First AKS creation succeeded, but default DNS could not resolve its API hostname. Public resolver returned an IP; kubectl connected successfully with --server and --tls-server-name, preserving certificate verification. Both demo groups were deleted; retry was cancelled when the user switched to App Service.


- [x] Azure App Service: Frontend/backend deployed together on Linux Free F1; HTTPS, readiness and API authentication checked; user Supabase portal settings configured.


- App Service change verified: compiled frontend served by production Express with deep-link refresh, explicit Supabase CSP origin and unchanged API authentication. All 25 backend + 12 integration + 7 frontend tests (44 total), strict checks, build and audit pass. Local production health/hosted readiness/deep-link/401 smoke checks pass. Free Linux plan confirmed; Supabase setting names saved by user. ZIP deployment completed successfully.


- Azure startup investigation: required portal settings validate; original deploy build reported success but runtime exited and Azure reported QuotaExceeded. Replacement default site also blocked before code upload; log endpoint returned Site Disabled. No CPU/storage overrun shown in available counters. Self-contained ZIP verified on Linux as uid 1000 with read-only filesystem: health/ready ok, SPA and JS assets 200, private API 401. Temporary verification container removed. Node 22 runtime is verified on the same Free plan; no paid upgrade.


- Azure replacement is live at https://algodeck-202610111929-web.azurewebsites.net on Free F1 with Node 22 LTS. Self-contained deployment reports Site started successfully; HTTPS health ok, Supabase ready, frontend 200, private API 401. Hosted sign-in and saved practice verified. User portal settings carried over. Free hosting block cleared at 20:00 UTC; initial startup cause unconfirmed because runtime logs were blocked.


- Failed first App Service deleted; resource list shows only the running replacement. Plan readback confirms F1/Free. AKS and managed node group existence both false. Brief AKS provisioning may appear in delayed billing; Free hosting has quotas and cold starts.
- [x] Azure hosted verification: User signed in; the hosted dashboard loaded the saved demo collection and five completed reviews. The session summary showed 2 Easy, 1 Medium and 2 Hard ratings. Refresh restored authentication and the saved summary. Proof: docs/screenshots/azure-practice-complete.jpg. No credentials were requested or copied.

