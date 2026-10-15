# Ducere catalogue source policy

## Current implementation

- The built-in curated shelf remains the immediate fallback and works without external catalogue services.
- Series are searched on demand through TVmaze's public search endpoint. TVmaze states that its API is licensed under CC BY-SA and allows commercial use when attribution and ShareAlike requirements are met; search results link back to TVmaze. Before server-side persistence, we must review how ShareAlike applies to Ducere's database and presentation.
- Films, TV, and anime are also searched on demand through Wikidata's structured data, which is released under CC0. Results use a generated poster fallback rather than copying image files from Wikidata; the detail page links to the Wikidata item.
- Neither provider is crawled in bulk at app startup, and the current search module does not persist external responses to browser storage or Supabase.

## Do not do

- Do not scrape Google Search results or build a permanent database from them without express permission.
- Do not bulk-import/copy provider catalogues until the applicable terms explicitly permit the intended collection, commercial use, caching, images, redistribution, and scale.
- Never expose a Supabase service-role key in browser code or a VITE_ environment variable.
- Do not claim streaming availability unless a source specifically confirms it for the user's country and the result has a freshness timestamp.

## Source review queue

1. TVmaze: public API docs say CC BY-SA, allow commercial use with attribution and ShareAlike; confirm the implementation's obligations before production catalogue persistence. https://www.tvmaze.com/api
2. Wikidata: structured data is CC0. Follow Wikimedia API usage guidelines and rate limits; do not overload the public API. https://www.wikidata.org/wiki/Wikidata:Data_access/en
3. Wikimedia/Wikipedia article text and images: licensing varies by page and media file; high-volume commercial access has separate guidance. Not used for bulk catalogue ingestion by this implementation.
4. Jikan/MyAnimeList: unofficial scraper-backed API; do not use for permanent bulk ingestion until its terms and upstream rights have been reviewed.
5. AniList: no bulk catalogue import until the current terms and data reuse limits have been reviewed.
6. TMDB: no commercial catalogue use until the correct license/terms are confirmed.
7. Google: search scraping is not an approved catalogue ingestion method. Knowledge Graph can be evaluated for individual entity lookups, not treated as a complete entertainment database.

## Target architecture

1. Query Ducere's own catalogue first when the database is active.
2. On a miss, query only a reviewed source, on demand.
3. Show attribution and the source URL where required.
4. Store only fields the source license permits Ducere to retain; record source, license, fetched time, and expiry.
5. Add trusted server-side ingestion only after licensing and database readiness are verified.
6. Keep streaming availability separate from catalogue metadata and refresh it according to the provider's permitted caching window.
