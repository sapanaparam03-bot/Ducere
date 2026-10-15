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

## 3. Streaming availability Edge Function

Deploy `supabase/functions/watchmode-availability/index.ts` as `watchmode-availability` and set the server-side `WATCHMODE_API_KEY` secret. The function requires a valid signed-in user's access token. If the provider secret is absent, the expected behavior is a clear unavailable/configuration response, not fabricated availability.

Test exact and ambiguous title names, year mismatches, region changes, unsupported titles, invalid credentials, and provider-link destinations. Confirm that subscription, rental, and purchase offers remain distinguishable.

## 4. Account deletion Edge Function

Follow `docs/ACCOUNT-DELETION-DEPLOYMENT.md`. The function must be deployed as `delete-account` with server-side Supabase URL, anon key, and service-role key secrets. Verify deletion using a dedicated test account and check that the Auth user and dependent rows are removed.

## 5. Release gate

Do not label the service production-ready until all checks in `docs/RELEASE-READINESS-CHECKLIST.md` are complete for a recorded commit, browser/device, and date. Automated CI does not replace live browser testing.
