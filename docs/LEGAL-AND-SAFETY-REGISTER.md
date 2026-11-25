# Ducere legal, licensing, privacy, and safety register

**Status: internal engineering register — not a legal opinion, not a public policy, and not proof of compliance.**  
**Last reviewed:** 25 November 2026  
**Target:** pre-launch review for the Ducere web application.

This document records known third-party services, licensing constraints, product safeguards, and release blockers. Recheck the linked terms immediately before any public or commercial release. Preserve dated copies or hashes of the terms reviewed and record the person who approved each source.

## 1. Non-negotiable product rules

- Do not scrape Google Search, streaming services, or third-party catalogues.
- Do not bulk-copy, mirror, or permanently store third-party catalogue data unless a licence expressly permits the exact fields, purposes, caching, redistribution, geography, and commercial model.
- Treat community submissions as user-generated claims, not proof of streaming availability.
- Keep new availability reports pending until evidence and moderation meet the verification standard. Votes alone never establish truth.
- Use only official provider destination links; validate URLs server-side and do not fetch arbitrary user-submitted URLs from the server.
- No posters, backdrops, stills, thumbnails, or third-party artwork in the initial release. Use original Ducere text/colour placeholders only.
- Do not use third-party logos, platform trade dress, ratings, review excerpts, synopsis text, or promotional assets without rights for the exact use.
- Keep personal library records private to their owner. Keep service-role credentials and all provider secrets server-side.
- Never describe the catalogue as exhaustive or every listing as current. Show country, access type, evidence/status, and last-verified date.

## 2. Third-party service and source register

| Service/source | Current or intended use | Rights/controls | Launch decision |
|---|---|---|---|
| Supabase | Authentication, database, Edge Functions | Apply current Supabase terms/DPA; RLS on every exposed table; server-only service-role key; configure Auth redirects, backups, deletion and retention | Required; live database access is currently failing and must be restored/tested |
| Vercel | Static hosting/deployment | Review current Terms, Acceptable Use Policy, Privacy Notice and DPA; configure environment variables and security headers | Required; verify current project settings and data region/processing |
| GitHub | Source control, CI, Dependabot | Keep secrets out of repo; restrict tokens; enable secret/dependency scanning where available; protect main branch | Required; verify branch protection and workflow permissions |
| TVmaze API | On-demand TV series search | TVmaze says public API data is CC BY-SA; attribution/linking and ShareAlike apply. Do not persist/redistribute data until compatibility with Ducere's database and presentation is reviewed. | Transitional only; disable or obtain an appropriate commercial licence before commercial use if needed |
| Wikidata | On-demand entity/metadata lookup | Structured data is CC0; follow Wikimedia API usage guidelines, rate limits and stability guidance; attribution is encouraged | May be used for limited lookups; do not bulk-scrape or overload endpoints |
| Google | Potential future partner/integration | No Google Search scraping. Any Knowledge Graph or other API use must be separately reviewed against its current terms, quotas and licence | No current catalogue ingestion approved |
| TMDB | Previously considered; not approved as a current source | Do not use commercial data or artwork without a valid licence and compliance with its terms | Not approved for production ingestion |
| Jikan / MyAnimeList | Previously considered; not approved | Unofficial scraper-backed route; no bulk or persistent import until upstream rights and terms are established | Not approved |
| AniList | Previously considered; not approved for bulk ingestion | Review current API terms, attribution, rate limits, caching and commercial use before use | Not approved for bulk ingestion |
| IMDb / Rotten Tomatoes | Possible title ratings/info feature | Publicly visible scores, brand assets and text are not automatically licensed for republication | Do not display scores/logos/excerpts until an authorised source/licence is selected |
| Streaming providers | Provider names and official watch links | Use names as factual identifiers carefully; no logos, scraping, deep links or availability claims without permission/evidence | Community evidence only; moderation and freshness required |

### Source links

- TVmaze API/licensing: https://www.tvmaze.com/api
- TVmaze API plans: https://www.tvmaze.com/api/plans
- Wikidata reuse and API best practices: https://www.wikidata.org/wiki/Wikidata:Reuse
- Wikidata data access: https://www.wikidata.org/wiki/Wikidata:Data_access/en
- Watchmode API terms: https://api.watchmode.com/tc
- Watchmode plans: https://api.watchmode.com/pricing
- Supabase legal: https://supabase.com/legal
- Vercel legal: https://vercel.com/legal
- Vercel Acceptable Use Policy: https://vercel.com/legal/acceptable-use-policy
- GitHub Terms: https://docs.github.com/site-policy/github-terms/github-terms-of-service

## 3. Approved replacement: CC0 metadata + Ducere community availability

- Wikidata structured data is CC0. It is the sole approved external title-metadata lookup source in the current implementation. Use the official API, descriptive User-Agent, rate-limit handling and item links. Do not treat Wikipedia prose or Wikimedia Commons media as CC0 by association.
- Streaming availability is not sourced from a third-party API. The intended substitute is Ducere's own community-reporting system, with evidence links, country-specific records, moderation, expiry and audit history.
- Evidence URLs must not be fetched server-side. Store the link and review it manually; this avoids scraping and SSRF.
- The community schema is a proposal only until the live database is accessible, reviewed, applied and tested. Until then, the app intentionally reports no confirmed availability.
- Watchmode application code has been removed. The deployed Supabase function and any stored API key still require dashboard-side removal because the available management integration cannot delete functions or secrets. A disabled replacement may be deployed to stop requests, but it is not the same as deletion.

## 4. Privacy and personal-data inventory to verify against code

The app's intended features can involve:
- Account identifiers and authentication/session data managed by Supabase.
- Profile details and settings, including username, country/region, appearance and selected streaming services.
- Personal library records: title identifiers, watch status, dates, episode progress, ratings and reviews.
- User-submitted catalogue corrections, evidence URLs, votes, moderation and reputation records once the community system is implemented.
- Import/export files and metadata from external services if those flows are enabled.
- Technical request/security logs retained by Supabase, Vercel, GitHub or API providers under their respective terms.

This is a preliminary feature-based inventory, not a confirmed statement of every field or processor. Before publishing a privacy notice, inspect the live code and each provider dashboard to confirm: analytics/telemetry, cookies/local storage, IP/device logs, email delivery, support channels, payment data (if any), retention periods, subprocessors, data locations, international transfers, and deletion propagation.

**Do not collect sensitive personal data or unnecessary birth dates.** If age screening or guardian consent is required for a third-party provider, collect the minimum information needed and have the mechanism legally reviewed.

## 4A. Built-in catalogue and metadata provenance

The built-in curated shelf contains title names, release years, genres, numeric ratings, plot descriptions, cast/director names, runtime values, and provider references. The current code uses Ducere-generated SVG cover placeholders, but the origin and licence/provenance for each factual or editorial field are not fully recorded in a field-level source register.

Before public or commercial release:
- Trace every curated title field to its original source or document that it was independently authored/verified by Ducere.
- Treat numeric ratings and review scores as a separate third-party data source; do not assume IMDb, Rotten Tomatoes, TMDB, or another site's score can be republished because it is visible online.
- Rewrite plot summaries in original wording or obtain a licence; do not copy provider synopses or editorial text.
- Record provenance and permitted use for cast, crew, release dates, runtime, genres, and provider references. Facts may be treated differently from expressive text or protected database compilations, but database rights and contract terms can still apply.
- Remove or suppress any field whose source or permitted use cannot be established.
- Keep provider names as factual identifiers only; remove logos and any implication of endorsement.
- Confirm that the built-in placeholder is an original Ducere asset and that no external poster URL is loaded. The initial release must remain poster/artwork-free.

## 5. Privacy, consumer and age compliance

- Prepare a real Privacy Notice and Terms of Service before public registration. They must name the actual operator/data fiduciary, contact channel, purposes, lawful basis/consent mechanism, data categories, processors, retention, deletion, user rights, international transfers, community-content rules, moderation/appeals, liability limitations and governing law.
- For India, review the Digital Personal Data Protection Act, 2023 and the Digital Personal Data Protection Rules, 2025, including the phased commencement notification and provisions actually in force on the release date. Do not assume every provision has commenced at the same time.
- Assess applicable rules for the US, UK, EU/EEA, Canada, Germany and Australia before enabling those markets. Determine whether children's data is processed and whether age-related restrictions or parental consent apply.
- Watchmode's own API terms say access is unavailable to users under 13 and require parent/legal-guardian approval for minors over 13 who are below the applicable age of majority. This requirement must be handled or the Watchmode integration must be disabled for those users.
- Establish a privacy contact and a process for access, correction, deletion, grievances and regulatory requests.
- Provide account deletion and data export that cover Auth, profile/library data, community contributions where legally deletable, backups/retention exceptions, and third-party copies where applicable.
- Obtain qualified legal review for the actual operator, launch jurisdictions, product age range and business model. This document is not a substitute.

India reference: https://www.meity.gov.in/data-protection-framework

## 6. Community catalogue and user-generated content safeguards

- Require authenticated, verified accounts for report submission and voting.
- Enforce one vote per account per report in the database; prevent authors voting on their own reports.
- Enforce ownership and moderator privileges server-side. Never trust client-editable profile/user metadata for moderator roles.
- Keep public catalogue read policies separate from private reports, evidence, user profiles, votes and moderation logs.
- Use RLS on every exposed table; public users may read only approved public catalogue and verified availability fields.
- Add database constraints for country codes, media/access/status enums, URL schemes, uniqueness and foreign keys.
- Add server-side rate limits, spam/abuse controls, duplicate detection, appeals and audit history.
- Reject unsafe URL schemes and local/private network destinations. Do not server-fetch arbitrary evidence URLs (SSRF risk).
- Provide a clear report/takedown channel for copyright, trademark, privacy and inaccurate-content complaints.
- Do not let community users upload posters or other copyrighted media in the initial release.
- Explain that user submissions are claims, not endorsements by Ducere or streaming providers. Remove unlawful or infringing material promptly after review.

## 7. Security and infrastructure release controls

- Keep `SUPABASE_SERVICE_ROLE_KEY`, `WATCHMODE_API_KEY` and all privileged secrets only in server-side secret storage. Never use a `VITE_*` variable for secrets.
- Verify Vercel Production and Preview environment variables separately; rotate any secret ever committed, logged or exposed.
- Confirm RLS, table grants, storage policies, Auth redirect allowlists, JWT verification on protected Edge Functions and safe error messages.
- Test two-account data isolation, privilege escalation, session revocation, password reset, account deletion, export, rate limiting, malformed payloads, URL validation, and abuse cases.
- Review CSP and other security headers against the actual deployed origins; do not deploy a restrictive CSP until tested.
- Keep dependencies locked; review Dependabot updates individually and run CI, tests, typecheck, build and dependency audit.
- Protect `main`, require successful CI before merge, restrict workflow token permissions, and avoid untrusted pull-request code receiving secrets.
- Confirm backups, restore drills, monitoring, incident response and a rollback procedure.
- Run an independent security review/penetration test before a broad public launch.

## 8. Software and asset licensing

- Generate an SBOM and dependency licence report from the committed lockfile before release.
- Check each direct and transitive dependency's exact version, licence, notices, and any attribution/source-distribution obligations. Do not infer package licences from package names.
- Keep required third-party notices in a bundled notices file and include them in the product's legal/about surface where required.
- Do not add a permissive root `LICENSE` unless the owner explicitly decides to open-source Ducere. The repository is currently marked private in package metadata; project ownership and commercial IP terms should be documented separately.
- Confirm rights for the Ducere wordmark, icon, fonts, illustrations, UI icons and any marketing material. Prefer original assets or documented licences.
- Posters and third-party artwork remain out of scope. Do not reintroduce artwork fields into the new catalogue schema.

## 9. Release decision checklist

A release is blocked until all are true:
- [ ] Live Supabase database is reachable; schema and migrations are inventoried.
- [ ] RLS/security/performance/health advisors are reviewed and all material findings resolved.
- [ ] Production Auth, Edge Function secrets and deletion workflow are verified without exposing secret values.
- [ ] The community catalogue schema and moderation workflow are implemented, tested and reviewed before any public submissions are enabled.
- [ ] Watchmode is disabled or the actual plan, permitted markets, attribution, cache and age/guardian obligations are satisfied in writing.
- [ ] TVmaze ShareAlike and attribution obligations are satisfied or TVmaze is disabled/replaced for the intended commercial use.
- [ ] All other external sources have documented permission and field-level licence review.
- [ ] Privacy Notice, Terms, contact details, age rules, deletion and grievance process are complete and legally reviewed.
- [ ] Dependency SBOM/licence notices and all artwork/font/icon rights are recorded.
- [ ] CI/security workflows pass on the release commit; branch protection and secret scanning are configured.
- [ ] Manual browser tests pass for all user journeys, including two-account isolation and mobile layouts.
- [ ] Backup/restore, monitoring, incident response and rollback are tested.
- [ ] A qualified reviewer signs off for each intended launch jurisdiction.

**Current status:** Not cleared for public/commercial launch. The live Supabase database is reported ACTIVE_HEALTHY by project metadata but database queries time out and advisors report hibernation. The community catalogue is still a documented target architecture, not a deployed production feature. The current Watchmode Developer/free plan is not suitable for commercial use. No claim of legal certification or production readiness should be made until the release gates above are completed.
