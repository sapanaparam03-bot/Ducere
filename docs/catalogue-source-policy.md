# Ducere catalogue source policy

## Approved current source

### Wikidata — CC0 structured data

Wikidata's structured data is released under Creative Commons Zero (CC0). This is the approved external source for individual, user-initiated title lookups and factual metadata. Ducere links each result to its Wikidata item. CC0 permits reuse without attribution as a copyright condition; Ducere still provides source links for transparency and provenance.

- Official licensing: https://www.wikidata.org/wiki/Wikidata:Licensing
- Data reuse: https://www.wikidata.org/wiki/Wikidata:Reuse
- API access and rate limits: https://www.wikidata.org/wiki/Wikidata:Data_access
- SPARQL access policy: https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service/API

Operational rules:
- Use the official Wikidata API for user-initiated searches, not bulk scraping.
- Identify the app with a descriptive User-Agent and handle HTTP 429 responses.
- Retain QIDs and source URLs; cache only as permitted by Wikimedia API policies.
- Structured data is CC0; do not assume Wikipedia article prose, Commons images, logos, or other Wikimedia content has the same licence.
- Use only fields actually returned from Wikidata. Do not invent missing facts.
- Do not use Wikidata as a streaming availability source.

## Sources not used by the current app

- **TVmaze:** Its public API is CC BY-SA. Commercial use is allowed subject to attribution and ShareAlike, but Ducere has removed TVmaze from new catalogue searches to keep the initial source stack simpler. Existing locally saved TVmaze title records are retained as legacy user-library data and are not queried or refreshed. https://www.tvmaze.com/api
- **TMDB:** Free API access is limited to non-commercial use with attribution; commercial use requires a separate licence. Not used. https://developer.themoviedb.org/docs/faq
- **IMDb / Rotten Tomatoes:** No public reuse licence for the intended commercial catalogue/ratings use has been established. Do not copy scores, reviews, text or logos.
- **OMDb:** Its terms restrict use to personal/non-commercial purposes; not suitable for a commercial catalogue. Not used. https://www.omdbapi.com/legal.htm
- **Jikan / MyAnimeList:** Do not use unofficial scraper-backed routes or upstream data without clear written rights for Ducere's intended storage and commercial use.
- **AniList:** Do not bulk-import or persist data until the current API terms and exact reuse/caching rights have been reviewed.
- **Google Search:** No scraping, result copying, or search-derived catalogue. Any future official API must be reviewed separately.
- **Streaming services:** No crawling, scraping, reverse engineering, or automated extraction of provider catalogues. Official title URLs may be submitted by users as evidence, but Ducere does not fetch or copy page content.

## Streaming availability: Ducere-owned community source

Watchmode has been removed from application code. There is no third-party availability API.

- Users may submit factual claims that a title is offered by a service in a particular country.
- A submission includes title ID, country, provider name, access type, official title URL, evidence URL and a reason.
- Evidence URLs are stored as links only. Ducere does not scrape, proxy, or server-fetch provider pages.
- Reports begin as pending. Votes are signals only and cannot automatically establish availability.
- Only trusted moderation may publish a verified claim after reviewing evidence.
- Verified claims expire unless rechecked; disputed or expired reports are not shown as current.
- Provider names are factual identifiers; no logos or implied endorsements.
- Until the community database and moderation workflow are deployed and security-tested, the app deliberately displays no confirmed availability.

## Built-in curated titles

The current built-in shelf contains editorial descriptions and factual fields whose individual source history is not fully recorded. Aggregate ratings and hard-coded streaming-provider claims have been removed from the curated-title builder. Before public/commercial release, review each remaining synopsis, cast/crew, runtime, genre and release-year field. Keep only independently authored or appropriately licensed text and facts with documented provenance. For future catalogue records, prefer Wikidata CC0 structured facts and Ducere-authored descriptions.

## Do not do

- Do not copy a third-party database merely because individual facts are not copyrightable.
- Do not copy expressive text, reviews, images, logos, or database compilations without permission.
- Do not claim availability from stale, unverified, or user-voted-only reports.
- Never expose Supabase service-role credentials in browser code or VITE_ variables.
- Keep posters, backdrops, stills and third-party artwork out of the initial product.

This is an engineering source policy, not a legal opinion. Recheck current terms and applicable database rights before commercial launch.
