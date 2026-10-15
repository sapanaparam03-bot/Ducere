# Ducere

**Track what you watched, what you want to watch, what you're watching, and where you can watch it.**

Ducere is a responsive React + Vite app for tracking movies, television, and anime. It includes a personal library, watchlist, in-progress tracking, title details, recommendations, calendar, profile insights, import/export tools, and region-aware streaming availability integrations.

## Development

Requirements: Node.js 20+ and npm.

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run dev
```

## Deploying the web app

The repository is configured for Vercel static hosting and client-side routes. Import `sapanaparam03-bot/Ducere` into Vercel, keep the project root at the repository root, use the Vite framework preset, and set the build command to `npm run build` and output directory to `dist`.

Configure these Vercel environment variables for cloud accounts and cross-device sync:

- `VITE_SUPABASE_URL`: the project URL from Supabase.
- `VITE_SUPABASE_ANON_KEY`: the Supabase publishable/anon key.

These are browser-visible configuration values. Never set a Supabase service-role key as a `VITE_*` variable or commit secrets to this repository. Without these two values, Supabase cloud features are not configured.

## Supabase setup

1. Create or restore the intended Supabase project.
2. Review `supabase-schema.sql`, then run it in that project's SQL editor. It enables Row Level Security and limits profile/archive rows to the signed-in owner.
3. Set the two Vite environment variables in Vercel and redeploy.
4. Configure email/auth redirect URLs for the final production domain.
5. Deploy and test Edge Functions separately; see `docs/PRODUCTION-SETUP.md` and `docs/ACCOUNT-DELETION-DEPLOYMENT.md`.

The `watchmode-availability` Edge Function needs the server-side `WATCHMODE_API_KEY` secret. The `delete-account` function needs `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` configured as Edge Function secrets. Do not expose the service-role key to the browser.

## Release readiness

Passing automated tests and a production build is necessary, not sufficient. Authentication, RLS isolation, multi-device persistence, account deletion, and live provider lookups must be tested against an active Supabase project before calling the app production-ready. Follow `docs/RELEASE-READINESS-CHECKLIST.md`.

## Key docs

- `docs/PRODUCTION-SETUP.md` — deployment and secret configuration.
- `docs/RELEASE-READINESS-CHECKLIST.md` — release gates and manual smoke tests.
- `docs/ACCOUNT-DELETION-DEPLOYMENT.md` — secure account deletion setup.
