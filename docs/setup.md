# Supabase setup

## Existing hosted project

1. In project settings, copy the project URL and publishable key (legacy anon key also works).
2. Fill `backend/.env` with `SUPABASE_URL`, `SUPABASE_PUBLIC_KEY`; fill `frontend/.env` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLIC_KEY`. Frontend keys are public. Never put service-role or secret keys in a `VITE_` variable.
3. From the repository root, run `npx supabase login`. Complete the official CLI authentication flow. Keep your access token in the CLI credential store, not source or chat.
4. Run `npx supabase link --project-ref YOUR_PROJECT_REF`. Enter the database password locally if requested. The ref is the hostname prefix of the project URL.
5. Run `npm run db:migrate`. Review the pending migration names before confirming any CLI prompt. This applies the committed schema; it does not reset the project.

Alternatively run all SQL files in `supabase/migrations` in filename order through Supabase SQL Editor on a fresh project. Do not run them twice: use migration history and future versioned migrations for updates. The CLI workflow is preferred.

## Auth settings

Enable email/password sign-up. For development, use Site URL `http://localhost:5173` and allow `http://localhost:5173/auth` and `http://127.0.0.1:5173/auth`. Production must use the deployed HTTPS origin and `/auth` redirect. Email confirmation is supported; configure mail delivery. Browser sessions use Supabase PKCE, persistence, refresh, and session restoration. PKCE email links should be opened in the browser where registration began.

The API calls Supabase `auth.getUser(accessToken)` for every authenticated request. Supabase Auth verifies the issued token on its own trusted server, including validity/expiry; the app does not decode a JWT and treat it as proof. This supports legacy and asymmetric signing keys without maintaining a separate JWT secret. An invalid/expired token produces 401 and the frontend signs out locally. [Official getUser documentation](https://supabase.com/docs/reference/javascript/auth-getuser).

## Local stack

Start Docker Desktop, then from this repository:

```powershell
npx supabase start
npm run db:migrate -- --local
npx supabase status
```

Use the local URL and anon/publishable key shown by `supabase status` in the two `.env` files. Restart the app. Local email confirmation is disabled by the committed config; hosted settings are independent. Never copy the displayed service-role key into the frontend.

## Development seeds

Create a development user through the app. Set `SEED_EMAIL` and `SEED_PASSWORD` privately in `backend/.env` for that account, then run `npm run db:seed`. Remove these variables after use. The script signs in with the public key and seeds only that user through RLS. Repeated runs skip duplicate questions; production secrets and administrative credentials are unnecessary.

`supabase/seed.sql` is a second, SQL-only local seeding entry point. Without a configured auth UID it intentionally does nothing. To use it, start a transaction in the local SQL Editor, set `request.jwt.claim.sub` to an existing local user's UUID, execute seed.sql, and commit. It never creates fake auth users.
