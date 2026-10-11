# AlgoDeck design

Build the adaptive practice and revision platform specified in prompt.txt. The product supports arbitrary question collections, configurable daily targets, imports, persisted sessions, Easy/Medium/Hard ratings, revision queues, and analytics.

## Architecture

Use npm workspaces: shared Zod contracts, React/Vite frontend, and Express backend. The frontend uses Supabase Auth, React Router, TanStack Query, React Hook Form, Tailwind and Recharts. The API verifies access tokens through Supabase Auth getUser and uses a per-request Supabase client forwarding the verified bearer token. No service-role credential is needed.

Tables use UUIDs, composite ownership foreign keys and RLS. Transactions exposed through narrowly scoped SQL functions create sessions, rate questions, import questions and deliberately delete collections. These functions explicitly authorize the caller and have fixed search paths and restricted grants. Attempts are immutable to application users. A standalone TypeScript scheduler computes weights, intervals and seeded sampling; database functions validate its inputs and serialize mutations.

## Behavior

Sessions are unique per user, collection and timezone-derived study date. Selected questions are persisted before response, and yesterday's selected questions are excluded, including unanswered ones. Never fill a shortage by violating eligibility or the new-question cap. Rating retries return the original attempt; contradictory retries return conflict. Rating and progress writes are atomic, guarded by expected attempt count.

Deletion preserves history: questions are archived; empty/unpracticed collections can be permanently deleted through a checked transaction, collections with sessions must be archived. Imports validate all rows and use all-or-nothing insertion with row errors. Duplicate identities use case-normalized title, category and pattern.

## Interface

A quiet study workspace: warm paper background, deep ink navigation, blue action color, serif editorial headings and compact question lists. Primary flow is dashboard → collection → daily practice → summary. Also provide collection settings, question editor with hint/solution metadata, paste/file import, JSON export, history, revision priorities and charts. Show genuine empty/loading/error states without fabricated data. Unconfigured installations show actionable setup guidance.

## Verification

Unit tests exercise scheduling/date boundaries and import validation. Embedded PostgreSQL executes canonical migrations and transactional functions with authenticated roles to verify constraints, RLS and immutable history. Supertest exercises API authentication, CRUD, imports, sessions and ratings through an isolated database adapter. Frontend tests exercise protected routes and user interactions. Build and strict type checks are mandatory. Actual Supabase Auth and PostgREST require the user's project configuration and separate live verification.
