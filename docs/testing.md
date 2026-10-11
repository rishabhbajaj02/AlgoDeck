# Testing and verification

`npm test` runs real scheduler/import logic, canonical migration SQL under PostgreSQL, and React user workflows. `npm run test:integration` sends HTTP requests through Express/Supertest and the actual Platform service to a disposable migrated PostgreSQL database.

PGlite embeds PostgreSQL, including PL/pgSQL, transactions, constraints and RLS. Tests create only a minimal auth.users/auth.uid fixture and authenticated role; they do not pretend to implement Supabase Auth. The test Gateway converts PostgreSQL date values into the JSON representation supplied by PostgREST. Production uses SupabaseGateway. Test authentication is injected at createApp's external auth boundary, never selected through a production environment flag.

The unit suite covers intervals, difficulty/overdue weights, seed determinism, duplicate prevention, yesterday exclusions, new caps, empty/insufficient pools, unchanged skipped progress, midnight/DST study dates, quoted CSV and malformed/oversized imports. Database tests cover ownership, grants, transactions, RPC access, immutable history, reverse-date exclusions, progress-lock ordering and deliberate deletion. API tests cover rejected/forged authentication, CRUD, atomic import/export/search, collection-wide facets, queue filters, two-user isolation, five simultaneous session requests, rating retries/conflicts, schedule persistence, completion and analytics. Frontend tests cover login validation/errors, registration confirmation, protected navigation, form targets, import validation, question navigation/rating, network-failure recovery and empty states.

These tests never connect to a hosted database or delete production data. PGlite serializes concurrent adapter transactions; the concurrency test verifies the API/idempotency contract, while actual PostgreSQL simultaneous connections should additionally be exercised on a dedicated local/test Supabase stack before launch.

## Live smoke test

After applying migrations to a development Supabase project:

1. Confirm `/api/ready` returns 200.
2. Register two real development accounts; confirm email and login/logout/refresh restoration.
3. Under account A, create a collection with daily target 5/new limit 5; import examples/questions.csv.
4. Generate a session, reload, resume, rate all questions and finish. Repeat session creation and confirm the same ID.
5. Inspect history, revision dates and analytics. Under account B, confirm A's IDs return 404 and no data appears in lists.
6. On the next study day, confirm yesterday's selected questions are absent. Do not change production database clocks to test this.
7. Inspect platform logs and audit records for safe fields. Verify HTTPS, redirect URLs and origin settings.

Hosted Auth, email delivery, PostgREST schema exposure, deployment logs and cross-process concurrency are external checks. Record them separately from the automated suite; do not describe them as verified based only on embedded tests.
