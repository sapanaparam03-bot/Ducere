import { coverArt, type Title, type TitleType } from './ducere';

type TvMazeSearchEntry = {
  show?: {
    id: number;
    name: string;
    url?: string;
    genres?: string[];
    rating?: { average?: number | null };
    image?: { medium?: string | null; original?: string | null } | null;
    summary?: string | null;
    premiered?: string | null;
    runtime?: number | null;
    averageRuntime?: number | null;
  } | null;
};

type WikidataSearchEntry = {
  id: string;
  label?: string;
  description?: string;
  concepturi?: string;
};

type WikidataSearchResponse = { search?: WikidataSearchEntry[] };

const stripMarkup = (value: string | null | undefined) =>
  (value ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

const yearFrom = (value: string | null | undefined) => {
  const year = Number(value?.slice(0, 4));
  return Number.isFinite(year) && year > 1800 ? year : 0;
};

const yearFromDescription = (value: string) => {
  const match = value.match(/\b((?:18|19|20)\d{2})\b/);
  return match ? Number(match[1]) : 0;
};

const mapTvMazeResult = (entry: TvMazeSearchEntry): Title | null => {
  const show = entry.show;
  if (!show?.id || !show.name?.trim()) return null;
  const poster = show.image?.original ?? show.image?.medium ?? coverArt(show.name, 'tv');
  const rating = show.rating?.average;
  const description = stripMarkup(show.summary);
  return {
    id: `tvmaze-${show.id}`,
    name: show.name.trim(),
    type: 'tv',
    poster,
    backdrop: poster,
    description: description || 'Series details supplied by TVmaze. Open the source for more information.',
    releaseYear: yearFrom(show.premiered),
    genres: show.genres?.length ? show.genres : ['Series'],
    rating: typeof rating === 'number' ? Math.round(rating * 10) / 10 : 0,
    runtime: show.averageRuntime || show.runtime ? `${show.averageRuntime ?? show.runtime} min episodes` : 'Series',
    cast: [],
    director: 'Not listed',
    providers: [],
    source: {
      name: 'TVmaze',
      url: show.url ?? `https://www.tvmaze.com/shows/${show.id}`,
      license: 'CC BY-SA',
    },
  };
};

const typeFromDescription = (description: string): TitleType | null => {
  if (/\b(anime|Japanese animated)\b/i.test(description) && /\b(series|film|movie|animation|television)\b/i.test(description)) return 'anime';
  if (/\b(television series|tv series|television show|television program|sitcom)\b/i.test(description)) return 'tv';
  if (/\b(film|movie|motion picture)\b/i.test(description)) return 'movie';
  return null;
};

const mapWikidataResult = (entry: WikidataSearchEntry, requestedType: 'all' | TitleType): Title | null => {
  const name = entry.label?.trim();
  const description = entry.description?.trim() ?? '';
  const detectedType = typeFromDescription(description);
  if (!name || !detectedType || (requestedType !== 'all' && detectedType !== requestedType)) return null;

  const year = yearFromDescription(description);
  return {
    id: `wikidata-${entry.id}`,
    name,
    type: detectedType,
    poster: coverArt(name, detectedType),
    backdrop: coverArt(name, detectedType),
    description: description || 'Basic factual metadata from Wikidata.',
    releaseYear: year,
    genres: [detectedType === 'movie' ? 'Movie' : detectedType === 'tv' ? 'Series' : 'Anime'],
    rating: 0,
    runtime: detectedType === 'movie' ? 'Feature film' : 'Series',
    cast: [],
    director: 'Not listed',
    providers: [],
    source: {
      name: 'Wikidata',
      url: entry.concepturi ?? `https://www.wikidata.org/wiki/${entry.id}`,
      license: 'CC0',
    },
  };
};

async function fetchJson<T>(url: string, signal: AbortSignal, wikidata = false): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (wikidata) headers['Api-User-Agent'] = 'Ducere/1.0 (https://github.com/sapanaparam03-bot/Ducere)';
  const response = await fetch(url, { signal, headers });
  if (!response.ok) {
    if (response.status === 429) throw new Error('The catalogue source is busy. Please wait a moment and try again.');
    throw new Error(`Catalogue search failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

async function withTimeout<T>(request: (signal: AbortSignal) => Promise<T>, parentSignal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(parentSignal?.reason);
  if (parentSignal?.aborted) controller.abort(parentSignal.reason);
  else parentSignal?.addEventListener('abort', abortFromParent, { once: true });
  const timeout = window.setTimeout(() => controller.abort(), 7000);
  try {
    return await request(controller.signal);
  } finally {
    window.clearTimeout(timeout);
    parentSignal?.removeEventListener('abort', abortFromParent);
  }
}

async function searchTvMaze(query: string, signal: AbortSignal): Promise<Title[]> {
  const url = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`;
  const entries = await withTimeout((requestSignal) => fetchJson<TvMazeSearchEntry[]>(url, requestSignal), signal);
  return entries.map(mapTvMazeResult).filter((title): title is Title => Boolean(title)).slice(0, 20);
}

async function searchWikidata(query: string, type: 'all' | TitleType, signal: AbortSignal): Promise<Title[]> {
  const params = new URLSearchParams({
    action: 'wbsearchentities',
    search: query,
    language: 'en',
    uselang: 'en',
    type: 'item',
    limit: '20',
    format: 'json',
    origin: '*',
  });
  const url = `https://www.wikidata.org/w/api.php?${params.toString()}`;
  const result = await withTimeout((requestSignal) => fetchJson<WikidataSearchResponse>(url, requestSignal, true), signal);
  return (result.search ?? [])
    .map((entry) => mapWikidataResult(entry, type))
    .filter((title): title is Title => Boolean(title))
    .slice(0, 20);
}

let activeSearchController: AbortController | null = null;

export function cancelExternalCatalogueSearch() {
  activeSearchController?.abort();
  activeSearchController = null;
}

/**
 * User-initiated search only: TVmaze supplies series metadata; Wikidata supplies
 * CC0 factual labels/descriptions for films, TV, and anime. No provider is crawled
 * in bulk, and no external response is permanently cached by this module.
 */
export async function searchExternalCatalogue(query: string, type: 'all' | TitleType = 'all'): Promise<Title[]> {
  const normalized = query.trim();
  if (normalized.length < 2) return [];

  cancelExternalCatalogueSearch();
  const controller = new AbortController();
  activeSearchController = controller;
  try {
    const [seriesResult, wikidataResult] = await Promise.allSettled([
      type === 'all' || type === 'tv' ? searchTvMaze(normalized, controller.signal) : Promise.resolve([] as Title[]),
      searchWikidata(normalized, type, controller.signal),
    ]);

    const titles = [
      ...(seriesResult.status === 'fulfilled' ? seriesResult.value : []),
      ...(wikidataResult.status === 'fulfilled' ? wikidataResult.value : []),
    ];
    const unique: Title[] = [];
    const seenIds = new Set<string>();
    for (const title of titles) {
      if (seenIds.has(title.id)) continue;
      seenIds.add(title.id);
      const normalizedName = title.name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const duplicate = unique.some((existing) => {
        if (existing.type !== title.type) return false;
        const existingName = existing.name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        return existingName === normalizedName &&
          (!existing.releaseYear || !title.releaseYear || existing.releaseYear === title.releaseYear);
      });
      if (!duplicate) unique.push(title);
    }

    if (controller.signal.aborted) throw new DOMException('Search cancelled', 'AbortError');
    if (unique.length === 0 && seriesResult.status === 'rejected' && wikidataResult.status === 'rejected') {
      throw new Error('Catalogue search is temporarily unavailable. Please try again.');
    }
    return unique.slice(0, 30);
  } finally {
    if (activeSearchController === controller) activeSearchController = null;
  }
}
