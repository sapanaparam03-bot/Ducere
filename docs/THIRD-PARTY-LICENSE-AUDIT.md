# Ducere — Third-Party Software & API License Audit

Last reviewed: 2026-09-20

## Purpose

This is the working commercial/IP audit for software libraries and external services used by Ducere.

It distinguishes:
- code that is part of Ducere;
- open-source dependencies that remain owned by their authors;
- external services/data that are licensed rather than owned.

This is a diligence record, not a legal opinion.

## Application dependencies

The current `package.json` includes the following major dependency groups.

| Dependency / group | Typical upstream license | Commercial-use note |
|---|---|---|
| React / React DOM | MIT | Permissive; retain notices where required |
| @supabase/supabase-js | MIT | Library is third-party; Supabase service is separately governed |
| Lucide React | ISC | Permissive; retain applicable notices |
| React Icons | MIT | Third-party icon library |
| date-fns | MIT | Permissive |
| Recharts | MIT | Permissive |
| Wouter | MIT | Permissive |
| TanStack Query | MIT | Permissive |
| Radix UI packages | MIT | Permissive |
| react-hook-form | MIT | Permissive |
| Sonner | MIT | Permissive |
| cmdk | MIT | Permissive |
| Embla Carousel | MIT | Permissive |
| next-themes | MIT | Permissive |
| react-day-picker | MIT | Permissive |
| vaul | MIT | Permissive |
| clsx | MIT | Permissive |
| tailwind-merge | MIT | Permissive |
| class-variance-authority | Apache-2.0 | Permissive; retain applicable notice |
| Vite / TypeScript / Tailwind build tooling | MIT / Apache-2.0 depending on package | Development/build tooling; audit exact lockfile versions before a transaction |

### Important

The table above is a working inventory based on the packages declared in the repository. Before a commercial transfer, the exact lockfile versions and their upstream license files should be frozen and rechecked. No dependency should be represented as Ducere-owned.

## External services and data

### Watchmode

Ducere uses a server-side Watchmode availability function.

Current Watchmode documentation states:
- its free Developer plan is non-commercial;
- Startup, Business and Enterprise plans permit commercial use;
- Watchmode retains ownership of its API and related IP;
- third-party images returned by the API are not automatically licensed to the customer.

Therefore Ducere should **not be sold or commercially operated on the free Watchmode plan** without written confirmation or an appropriate commercial plan.

Source:
https://api.watchmode.com/

### TMDB

If TMDB data/API is used by a deployed build, commercial use requires a commercial API license according to TMDB's current FAQ. Non-commercial use has attribution requirements, including the TMDB logo and notice.

Therefore:
- do not claim TMDB data/images as Ducere-owned;
- retain required attribution when applicable;
- obtain commercial permission if the product becomes commercial.

Source:
https://developer.themoviedb.org/docs/faq

### Supabase

Supabase is infrastructure used by Ducere. Ducere does not own the Supabase platform. Ducere owns/control its own application code, schema/configuration and user data rights subject to applicable terms and law.

### Vercel

Vercel is deployment infrastructure. Ducere does not own Vercel's platform or underlying software. Customer/application content is treated separately under Vercel's terms.

## Acquisition rule

For an acquisition conversation, the clean statement is:

> Ducere owns its original application code, product design and project materials, while third-party software, APIs, infrastructure and media remain subject to their respective licenses and terms.

Never represent third-party API data, posters, provider logos or open-source libraries as wholly owned Ducere IP.
