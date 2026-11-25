# Ducere production setup

This guide separates the static web deployment from the services that require a live backend.

## 1. Web deployment (Vercel)

- Import the GitHub repository `sapanaparam03-bot/Ducere`.
- Root directory: repository root.
- Framework preset: Vite.
- Install command: `npm ci`.
- Build command: `npm run build`.
- Output directory: `dist`.
- Add the environment variables below to Preview and Production as appropriate, then redeploy.

| Variable | Where it belongs | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Vercel client build environment | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Vercel client build environment | Publishable/anon key; browser-visible by design |

Do not put a service-role key in any `VITE_*` variable. All `VITE_*` values are compiled into browser-accessible assets.

The repository's `vercel.json` rewrites application routes to `index.html` and adds baseline browser security headers. Verify deep links such as `/library`, `/title/<id>`, and `/settings` after deployment.

## 2. Supabase database and auth

1. Restore/create the intended project and confirm it is active.
2. Inspect `supabase-schema.sql` before applying it in the Supabase SQL editor.
3. Confirm both `profiles` and `user_titles` have Row Level Security enabled and that policies constrain rows to `auth.uid()`.
4. Configure the production site URL and allowed redirect URLs in Supabase Auth.
5. Test sign-up, sign-in, sign-out, reload, archive/profile persistence, and isolation between two separate test accounts.

Never test destructive archive reset or account deletion using the owner's real account.

## 3. Community-powered streaming availability

Ducere does not use a third-party streaming-availability API. The approved replacement is the first-party community reporting workflow.

- Review `supabase-community-availability.sql`; do not apply it until the live database is reachable, a backup is confirmed, and the RLS policies have been independently reviewed.
- Seed the provider directory with names and official provider home URLs only. Do not add logos or scrape provider catalogues.
- Reports must begin pending. Only trusted server-side moderation may create or update verified claims.
- Evidence links must be HTTPS and must never be fetched by the server.
- Public reads must return only verified, unexpired claims for the selected country.
- Until the schema and moderation functions are deployed and tested, the UI intentionally displays no confirmed availability.

The old Watchmode Edge Function is retired. Delete it from Supabase and remove the `WATCHMODE_API_KEY` secret in the Supabase dashboard before release.

## 4. Account deletion Edge Function

Follow `docs/ACCOUNT-DELETION-DEPLOYMENT.md`. The function must be deployed as `delete-account` with server-side Supabase URL, anon key, and service-role key secrets. Verify deletion using a dedicated test account and check that the Auth user and dependent rows are removed.

## 5. Release gate

Do not label the service production-ready until all checks in `docs/RELEASE-READINESS-CHECKLIST.md` are complete for a recorded commit, browser/device, and date. Automated CI does not replace live browser testing.
