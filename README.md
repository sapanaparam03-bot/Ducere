# Ducere

**Track what you watched, what you want to watch, what you're watching, and where you can watch it.**

Ducere is a responsive React + Vite app for tracking movies, television, and anime. It includes a personal library, watchlist, in-progress tracking, title details, recommendations, calendar, profile insights, import/export tools, and a community-powered streaming-availability design.

## Product direction

Ducere's approved target direction is an independent, community-maintained catalogue for India, the United States, the United Kingdom, Canada, Germany, and Australia. Users can suggest corrections to streaming availability, provide evidence, and confirm or dispute reports. Community votes are not proof by themselves; verified listings require evidence and moderation. Posters and third-party artwork are excluded initially.

See [the community catalogue architecture](docs/COMMUNITY-CATALOGUE-ARCHITECTURE.md) for the data model, security rules, migration constraints, rollout phases, and acceptance criteria. This is the target architecture, not a claim that the replacement has already been deployed.

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
5. Deploy and test the account-deletion Edge Function separately; see `docs/PRODUCTION-SETUP.md` and `docs/ACCOUNT-DELETION-DEPLOYMENT.md`. Delete the retired Watchmode function and remove its API key from Supabase.

Wikidata is the only external catalogue lookup source currently used; its structured data is CC0. Streaming availability is being moved to Ducere's own community reports and moderation. No third-party availability API is called. The old Watchmode Edge Function and API key must be removed from the Supabase dashboard before release.

## Release readiness

Passing automated tests and a production build is necessary, not sufficient. Authentication, RLS isolation, multi-device persistence, account deletion, community-report abuse controls, moderation, and live availability freshness must be tested against an active Supabase project before calling the app production-ready. Follow `docs/RELEASE-READINESS-CHECKLIST.md`.

## Key docs

- `docs/COMMUNITY-CATALOGUE-ARCHITECTURE.md` — approved target architecture and rollout plan.
- `docs/catalogue-source-policy.md` — source, licensing, and data collection rules.
- `docs/PRODUCTION-SETUP.md` — deployment and secret configuration.
- `docs/RELEASE-READINESS-CHECKLIST.md` — release gates and manual smoke tests.
- `docs/ACCOUNT-DELETION-DEPLOYMENT.md` — secure account deletion setup.
