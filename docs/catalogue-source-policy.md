# Ducere catalogue source policy

## Current implementation

- The built-in curated shelf remains the immediate fallback and works without external catalogue services.
- Series are searched on demand through TVmaze's public search endpoint. TVmaze states that its API is licensed under CC BY-SA and allows commercial use when attribution and ShareAlike requirements are met; search results link back to TVmaze. Before server-side persistence, we must review how ShareAlike applies to Ducere's database and presentation.
- Films, TV, and anime are also searched on demand through Wikidata's structured data, which is released under CC0. Results use a generated poster fallback rather than copying image files from Wikidata; the detail page links to the Wikidata item.
- Neither provider is crawled in bulk at app startup. Search responses are held in memory; only when a user adds a returned title to their library is that selected title's metadata saved in that user's browser storage, together with its source URL/license, so the item can still be displayed after reload. This is not a shared server-side catalogue import.

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

## Streaming availability provider restrictions

- Watchmode's API terms (checked 4 November 2026) allow non-image data to be used in an app owned by the account holder, subject to the applicable plan. The Developer/free plan is **non-commercial only**, requires attribution/linking wherever its data is displayed, and permits up to 30 days of non-image caching. Commercial use requires a Startup, Business, or Enterprise plan. Do not market, monetize, or commercially distribute a build using Watchmode data on the free plan.
- The published Watchmode pricing currently lists Startup at USD $349/month and Business at USD $599/month. Verify current pricing and account entitlement before launch; this is a material ongoing operating cost, not an assumed free entitlement.
- Watchmode's API terms state that the API is unavailable to children under 13 and that users aged 13 to under 18 (or below the higher local age of majority) need parent/legal-guardian approval. Ducere must not claim universal access while relying on Watchmode. Implement an appropriate age/guardian-consent flow or restrict the Watchmode feature by age and jurisdiction, subject to legal review.
- Watchmode does not grant rights to third-party posters, backdrops, logos, or other images returned by its API. Do not use Watchmode image URLs as if they were licensed assets, and do not hotlink its image CDN. Obtain image rights separately or use Ducere-created placeholders.
- Do not resell or redistribute Watchmode data. Confirm the account's actual plan, attribution obligations, caching implementation, age restrictions, and commercial permissions before enabling commercial use.
- The current Edge Function returns provider names, offer types, region and provider destination URLs; it does not intentionally return image fields. Keep this separation.
- Recheck the provider terms before each commercial launch because terms and plans can change.

## Release legal gate

- Publicly accessible artwork is not automatically public domain or licensed for commercial display. Every poster, backdrop, logo, font, icon, and promotional asset must have a recorded licence/permission or be replaced by an original asset.
- Do not use IMDb, Rotten Tomatoes, streaming-service logos, or platform brand assets unless the relevant terms or a licence permit the exact use. A score or logo appearing on a public webpage is not permission to republish it.
- Keep source attribution visible where required, retain source/license/fetched-at metadata, and provide a takedown/contact process.
- Publish accurate Privacy Policy, Terms of Service, account deletion instructions, and contact details before opening registration to the public. Explain what personal data is collected, purposes, processors, retention/deletion, international transfers, and user rights. Obtain legal review for the countries where Ducere will be offered.
- For India, assess the Digital Personal Data Protection Act, 2023 and rules/commencement notifications in force at launch; do not assume that a generic privacy notice is sufficient. If serving children or users in other jurisdictions, assess age-related and local privacy requirements separately.
- These notes are engineering release controls, not a legal opinion or a guarantee of compliance.
