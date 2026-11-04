# Ducere independent community catalogue architecture

## Accepted product decisions

- Initial availability countries: India (IN), United States (US), United Kingdom (GB), Canada (CA), Germany (DE), Australia (AU).
- Data entry model: community submissions with evidence and moderation; votes are supporting signals, not proof.
- Catalogue scope: grow toward every title that can be lawfully recorded, without promising instant or exhaustive coverage.
- Posters, backdrops, stills, and third-party artwork are out of scope for the initial release. Use Ducere-created text/colour placeholders only.
- Preserve the existing user library, watchlist, watching status, episode progress, ratings/reviews, recommendations, calendar, insights, imports/exports, profiles, and settings.
- Do not scrape Google or streaming services, bypass access controls, or bulk-copy third-party catalogues. A user-submitted fact/link is not automatically permission to copy a provider's protected database or content.

### Verified code inventory (4 November 2026)

The following details were checked in the current `main` branch during implementation planning:

- `supabase-schema.sql` defines `profiles` and `user_titles`. The personal library primary key is (`user_id`, `title_id`), and `title_id` is text. Status values are `watchlist`, `watching`, and `watched`; season, episode, progress, rating, review, and dates are stored there. Preserve these fields and their values.
- `src/hooks/use-catalog.ts` currently merges a built-in catalogue with locally retained selected titles. Its current selected-title validation expects IDs prefixed `tvmaze-` or `wikidata-` and includes poster/backdrop fields. A migration must support legacy IDs and change this validation deliberately rather than silently dropping saved selections.
- `src/lib/catalogue-search.ts` currently performs user-initiated TVmaze show search and Wikidata entity search. It maps TVmaze artwork into poster/backdrop fields and includes TVmaze descriptions. Do not bulk import from these endpoints; replace this path only after Ducere's own title submission/search is ready.
- `src/lib/live-catalog.ts` currently returns the built-in `TITLES` list only; despite the name, it does not load the proposed shared database.
- `src/lib/availability.ts` calls the `watchmode-availability` Edge Function. `src/components/availability-panel.tsx` displays Watchmode attribution and calls returned records verified. Replace this carefully: the new UI must show pending/contested/expired states accurately and must not label unverified community submissions as verified.
- The existing `supabase-catalogue-schema.sql` is only a proposal. It is source-centric, contains poster/backdrop/still fields, and permits broad public reads. It does not implement community reports, votes, evidence, moderation, or reputation. Do not apply it unchanged.

### Compatibility and migration requirements

- Keep legacy IDs valid during migration; do not assume every existing ID can be rewritten immediately.
- Introduce a stable Ducere-owned ID for new catalogue records and a mapping table for legacy IDs.
- Preserve localStorage-selected titles where possible; migrate them only after title identity is checked and the user library is backed up.
- Keep the existing personal library schema and RLS intact until the new mapping and integration have passed tests.
- Remove poster rendering from the UI as a deliberate product change, but do not delete old artwork fields from existing records until the migration is verified and no feature depends on them.
- Replace the Watchmode UI's unconditional "verified" language with status-aware wording as part of availability integration.

## Current implementation facts and migration constraint

The current React/Vite app uses Supabase for accounts and personal library sync. The existing `public.user_titles.title_id` is text, so new catalogue IDs must remain stable text identifiers. The app currently has a built-in catalogue, on-demand TVmaze/Wikidata search, and a Watchmode availability Edge Function. These must not be removed until the replacement catalogue and availability workflow has passed feature-parity and migration tests.

The existing `supabase-catalogue-schema.sql` is an earlier proposal with third-party source-oriented fields and artwork columns. It is not the target design. Review it before use; do not apply it unchanged.

## Target architecture

1. **Ducere catalogue** — canonical records for titles, seasons, episodes, genres and aliases.
2. **Provider directory** — names and official home/landing URLs for streaming services; do not use provider logos without permission.
3. **Availability assertions** — country-specific claims that a title is on a provider, with access type, official destination URL, evidence, timestamps and status.
4. **Community corrections** — immutable reports proposing additions, removals or changes to availability.
5. **Independent verification** — eligible users can confirm or dispute a report once; one vote per user per report.
6. **Moderation and reputation** — suspicious activity, conflicts, duplicate reports, abuse and appeals are handled separately from ordinary voting.
7. **Audit history** — retain who changed what, when, why, and the prior value. Do not silently overwrite history.
8. **Existing personal library** — keep user-owned rows private and preserve stable title IDs when connecting them to the canonical catalogue.

## Suggested relational model

- `catalogue_titles`: stable text ID, canonical title, original title, media type (movie/tv/anime), release year/date, original language, synopsis only where independently authored or licensed, country of origin, maturity rating with rating source, created/updated timestamps, record state.
- `catalogue_title_aliases`: title ID, alias, language/region, alias type; unique normalized alias per relevant scope.
- `catalogue_genres` and `catalogue_title_genres`: normalized genres and many-to-many title mapping.
- `catalogue_seasons`: title ID, season number, title and dates.
- `catalogue_episodes`: title ID, season ID/number, episode number, title, air date, runtime. Do not require episode synopsis.
- `streaming_providers`: stable provider key, display name, official website URL, supported countries, active flag. No unlicensed logos.
- `availability_claims`: title ID, country code, provider ID, access type (subscription, ads, free, rent, buy), official destination URL, claim status, first reported, last verified, expires at, confidence, current/retired state.
- `availability_reports`: reporter user ID, target title/country/provider, action (add, remove, change access type/link), proposed values, reason, evidence URL(s), status, created/updated timestamps.
- `availability_votes`: report ID, voter user ID, vote (confirm/dispute), optional reason, created timestamp; unique(report_id, voter_id).
- `availability_evidence`: report ID, submitted URL, evidence type, submitted timestamp, review result. Store links and short notes, not copied provider pages or images.
- `catalogue_moderation_actions`: moderator, report/claim, action, reason, timestamp.
- `catalogue_change_history`: entity/table key, old/new structured values, actor, reason, timestamp. Restrict access to private moderation/audit roles.
- `contributor_reputation`: user ID, earned trust signals and moderation state. Reputation is computed from reviewed outcomes; users cannot edit their own score.
- `catalogue_import_batches`: only for approved, licensed datasets; records licence, permitted fields, source URL, import date, retention/expiry, and reviewer approval.

The existing `profiles` and `user_titles` tables remain in place. Add a nullable foreign key from `user_titles.title_id` only after all existing IDs have been mapped; do not break legacy local/imported titles.

## Availability lifecycle

- `pending`: submitted, not shown as confirmed availability.
- `verified`: reviewed against acceptable evidence and currently within its verification freshness window.
- `contested`: credible conflicting evidence or dispute; display uncertainty.
- `rejected`: report failed review.
- `expired`: freshness window elapsed; do not present as current availability.
- `removed`: confirmed no longer available; retain history.

Votes are not a simple majority switch. A report can be auto-eligible for review after a minimum number of independent confirmations, but only strong evidence or an authorised moderator can promote it to verified. For launch, use manual moderation for all changes. Later, carefully measured rules may streamline low-risk reports.

Suggested initial policy:
- Reporter cannot vote on their own report.
- One vote per authenticated account per report; changing a vote is allowed and audited.
- Require sign-in, email verification, basic rate limits, duplicate detection and abuse reporting.
- A report must identify title, country, provider, proposed change, and a reason; evidence URL is strongly encouraged.
- Prefer an official provider title page or official service search result URL. Do not require screenshots, and do not store screenshots of copyrighted catalogue pages by default.
- Never claim that a title is available based only on a search-engine snippet, an unverified comment, or a majority vote.
- Expire availability claims after a configurable period (initial suggestion: 30 days) unless re-verified. Tune by market/provider and show last-checked date.
- Keep an appeals path and moderator audit trail.

## Security and privacy requirements

- Enable RLS on every exposed table.
- Public/anonymous users may read only approved public catalogue and verified availability fields.
- Authenticated users may submit their own reports and votes; they cannot set report status to verified, change reputation, edit other users' reports, or write moderation/audit records.
- Use separate policies for reporter ownership and moderator actions. Never rely on `user_metadata` for roles.
- Moderator privileges must be assigned server-side in trusted app metadata or a protected role table, never by a client-editable profile field.
- Use database constraints for valid country codes, media types, statuses, access types, URLs, unique votes and duplicate report keys.
- Apply per-user and per-IP rate limits at the trusted server boundary; do not trust client-only throttling.
- Validate and normalise all URLs server-side; allow only HTTPS and reject unsafe schemes, local/private network destinations and malformed URLs.
- Do not fetch arbitrary user-provided URLs from the server (SSRF risk). Evidence links should be stored and opened by the user, or reviewed through a constrained allowlist-based checker.
- Keep service-role keys server-side only. Use a trusted Edge Function/RPC for report submission, vote changes and moderation transitions.
- Do not store unnecessary personal data in reports. Provide deletion/retention rules that preserve anonymised catalogue history where legally appropriate.

## Country and provider rules

Use ISO 3166-1 alpha-2 country codes: IN, US, GB, CA, DE, AU. A provider can be listed only for countries where it actually operates and where the relevant title listing can be checked. Provider names are factual identifiers; avoid unlicensed logos, trade dress, or implying endorsement. Do not invent official watch URLs; validate destination URLs and label uncertain links.

## Poster-free user experience

- Use original Ducere title tiles with title, year, type, genre and status.
- No third-party poster, backdrop, still, thumbnail, or image URL fields in the initial catalogue schema.
- Keep the visual hierarchy and title-detail experience; show a neutral designed placeholder.
- Add artwork later only through a separately reviewed asset-rights process.

## Rollout and implementation plan

### Phase 0 — inventory and safety
- Map current title IDs and existing local/cloud library formats.
- Identify all current catalogue and Watchmode call sites.
- Export/backup database before schema changes.
- Confirm live Supabase connection and inspect current tables/RLS before any migration.
- Freeze removal of existing provider code until replacement tests pass.

### Phase 1 — schema and access control
- Create a reviewed Supabase migration for the tables above.
- Add indexes for title search, country/provider availability, report queues, and freshness.
- Add RLS policies and database constraints.
- Add test fixtures for anonymous reads, authenticated report creation, vote uniqueness, and denied privilege escalation.
- Run Supabase security and performance advisors.

### Phase 2 — backend workflows
- Add trusted server-side functions for report submission, voting, moderation and claim promotion.
- Add duplicate detection and rate limits.
- Add immutable audit history and moderator tools.
- Add freshness expiry and stale-data handling.

### Phase 3 — application integration
- Make the Ducere database the primary search source.
- Add title submission, report-availability correction, confirm/dispute, report status and last-verified date UI.
- Add moderation queue and contributor reputation UI.
- Preserve all personal-library workflows and map old IDs without losing user progress.
- Remove posters from title cards and details without removing other title information.

### Phase 4 — seed and community growth
- Start with manually verified, legally collected seed records for the six selected countries.
- Import only datasets whose licence explicitly permits the intended use and retention.
- Do not promise a complete worldwide catalogue at launch; expand by verified coverage.
- Add new title suggestions with duplicate detection and moderation.

### Phase 5 — release validation
- Test two-user isolation, unauthorised status changes, vote manipulation, spam, URL validation, SSRF resistance, deletion, backups, data export, mobile layouts and performance.
- Run regression tests for watchlist, history, currently watching, episode progress, recommendations, calendar, insights and imports.
- Launch community corrections in a limited beta before opening to everyone.

## Acceptance criteria

- The app reads canonical titles and availability from Ducere's database first.
- No third-party catalogue/availability API is required for normal catalogue reads.
- Every public availability result has country, provider, access type, official link where available, status and last-verified date.
- Pending, contested and expired claims are never displayed as verified.
- No user can verify their own report or change another user's data.
- One account cannot create multiple votes on the same report.
- Moderation decisions and changes are auditable and reversible.
- Existing user history and episode progress survive migration unchanged.
- Poster/artwork fields are not required for any catalogue workflow.
- Every imported dataset has a recorded licence and permitted-use review.
- Automated tests and live Supabase RLS tests pass before rollout.

## Current blocker

The Supabase project reports ACTIVE_HEALTHY, but the live table-list operation timed out during this planning session. Therefore no schema migration has been applied and no production data has been changed. Retry live database inspection before Phase 1. The current Watchmode and on-demand catalogue integrations remain in place until the replacement is implemented and verified.
