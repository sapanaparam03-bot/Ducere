# Ducere catalogue source policy

## Current implementation

- The built-in curated shelf remains the immediate fallback and works without external catalogue services.
- Series are searched on demand through TVmaze's public search endpoint when a user enters a title query. The app does not crawl the full index at startup and does not save search responses to browser storage or Supabase.
- TVmaze states that its API is licensed under CC BY-SA and allows commercial use when attribution and ShareAlike requirements are met. The UI result includes a TVmaze source link. Before broad server-side reuse, we must review how the ShareAlike obligation applies to Ducere's database and presentation.
- Movie and anime provider integrations are intentionally not enabled as bulk catalogue imports by this change.

## Do not do

- Do not scrape Google Search results or build a permanent database from them without express permission.
- Do not bulk-import/copy provider catalogues until the applicable terms explicitly permit the intended collection, commercial use, caching, images, redistribution, and scale.
- Never expose a Supabase service-role key in browser code or a VITE_ environment variable.
- Do not claim streaming availability unless a source specifically confirms it for the user's country and the result has a freshness timestamp.

## Source review queue

1. TVmaze: public API docs say CC BY-SA, allow commercial use with attribution and ShareAlike; confirm the implementation's obligations before production catalogue persistence. https://www.tvmaze.com/api
2. Wikimedia/Wikipedia: content licensing varies by page and media file; high-volume commercial access has separate guidance. Not used for bulk catalogue ingestion by this implementation.
3. Jikan/MyAnimeList: unofficial scraper-backed API; do not use for permanent bulk ingestion until its terms and upstream rights have been reviewed.
4. AniList: no bulk catalogue import until the current terms and data reuse limits have been reviewed.
5. TMDB: no commercial catalogue use until the correct license/terms are confirmed.
6. Google: search scraping is not an approved catalogue ingestion method. Knowledge Graph can be evaluated for individual entity lookups, not treated as a complete entertainment database.

## Target architecture

1. Query Ducere's own catalogue first when the database is active.
2. On a miss, query only a reviewed source, on demand.
3. Show attribution and the source URL where required.
4. Store only fields the source license permits Ducere to retain; record source, license, fetched time, and expiry.
5. Add trusted server-side ingestion only after licensing and database readiness are verified.
6. Keep streaming availability separate from catalogue metadata and refresh it according to the provider's permitted caching window.
