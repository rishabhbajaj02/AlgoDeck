# AlgoDeck

A full-stack adaptive practice workspace for arbitrary question collections: algorithms, system design, language learning and more. React/Vite frontend, Express API, Supabase Auth and PostgreSQL persistence.

## Start here

Requirements: Node 24 LTS (Node 22.12+ also supported), npm, and a Supabase project. Docker is needed only for the complete local Supabase stack.

```powershell
npm install
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Set your project URL and **public publishable/anon key** in both files. Use the variable names in each example. Keep the two files out of Git. This app does not require a service-role key or database password at runtime. When local configuration already exists, preserve it.

Apply the canonical migrations:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npm run db:migrate
```

Configure Supabase Auth as described in [setup](docs/setup.md), then:

```powershell
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). API: [http://localhost:3001/api/health](http://localhost:3001/api/health). Swagger: [http://localhost:3001/api/docs](http://localhost:3001/api/docs).

Register, confirm your email if enabled, create a collection, import `examples/questions.csv` or `examples/language-learning.json`, and start daily practice. Each rating immediately persists an immutable attempt and updates the review schedule.

## Commands

| Command | Behavior |
|---|---|
| `npm run dev` | Build shared contracts and run Vite + Express with file watching |
| `npm run build` | Build shared JS/types, API JS, and production frontend |
| `npm run lint` | Strict TypeScript checks across contracts, API, tests and frontend |
| `npm test` | Scheduler/import/PostgreSQL unit tests and React workflow tests |
| `npm run test:integration` | Supertest API tests with disposable PostgreSQL and two authenticated users |
| `npm run db:migrate` | Apply pending migrations to the linked Supabase project |
| `npm run db:migrate -- --local` | Apply pending migrations to a running local Supabase instance |
| `npm run db:seed` | Import the example collection for an authenticated development account |
| `npm run security` | Audit production dependencies |
| `npm audit` | Audit all dependencies, including test tools |
| `npm run format` | Format the application source |
| `npm start -w backend` | Start the compiled API (after root build) |

## Repository

`frontend/src/features` contains routed product features; `frontend/src/components` contains reusable accessible primitives. `backend/src/controllers` validates HTTP inputs, `services` owns business behavior, and `repositories` accesses Supabase with the verified caller JWT. `shared/src` provides contracts and schemas. Canonical SQL exists only in `supabase/migrations`; it is exercised directly by database tests.

## Important behavior

- A session is unique per user, collection and timezone-local study date. Repeating creation returns the persisted session. SQL transactions protect concurrent generation.
- Questions selected yesterday are excluded today, even if unanswered. They retain their overdue priority and can return on a later day.
- New questions obey the collection’s new-question limit. A shortage is explicit; the app does not fill spots with ineligible questions. Empty sessions can be completed but remain the session for that study day.
- Easy/Medium ratings count as success. Hard ratings reset the success streak and increase priority. Default intervals are configurable heuristics, not scientifically validated optimal schedules.
- Question deletion archives the question; attempts and existing sessions remain. Collections with sessions must be archived. Only collections without practice history can be physically deleted.
- Imports are all-or-nothing on invalid rows, with row-level feedback. Repeated normalized title/category/pattern identities are skipped. JSON export can be imported again.
- Editing question text changes what existing sessions display; attempts preserve scheduling history, not historical copies of question text.

See [setup](docs/setup.md), [scheduling](docs/scheduling.md), [security and logging](docs/security.md), [testing](docs/testing.md), and [deployment](docs/deployment.md). The running API publishes [OpenAPI](http://localhost:3001/api/openapi.json).

## Troubleshooting

- **Database unavailable / not ready:** confirm the project URL/key, apply migrations, and check Supabase project availability. Auth can succeed before the application schema exists.
- **Confirmation email:** configure SMTP/Supabase email limits and allowed redirect URLs. Sign in after confirming.
- **No eligible questions:** yesterday’s exclusion, new-question limit, and future review dates are intentional. Add questions or adjust settings for the next study day.
- **CORS denied:** set `FRONTEND_ORIGIN` to the exact browser origin, including port. Restart the API.
- **Cannot reach API:** start both workspaces with root `npm run dev`; frontend `/api` requests use the Vite proxy.
- **Tests cannot connect to localhost:** Supertest needs loopback networking. Run outside a network-restricted sandbox.
- **Local Supabase cannot start:** start Docker Desktop first. Embedded database tests do not require Docker.
## Azure App Service

See [the App Service guide](docs/azure-app-service.md) for the Free-tier HTTPS deployment, required portal settings and updates. The frontend and backend run together; Supabase stays separate.

## Azure Kubernetes demo

See [the AKS guide](docs/azure-kubernetes.md) for deploying both containers to a temporary cluster, inspecting the app through localhost port forwarding, and deleting demo resources. A continuously running AKS cluster exceeds a $5 monthly budget.
