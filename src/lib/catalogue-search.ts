import { coverArt, type Title, type TitleType } from './ducere';
import { deduplicateCatalogueTitles, inferMediaTypeFromDescription } from './catalogue-utils.js';

type WikidataSearchEntry = { id: string; label?: string; description?: string; concepturi?: string };
type WikidataSearchResponse = { search?: WikidataSearchEntry[] };

const yearFromDescription = (value: string) => {
  const match = value.match(/\\b((?:18|19|20)\\d{2})\\b/);
  return match ? Number(match[1]) : 0;
};

const mapWikidataResult = (entry: WikidataSearchEntry, requestedType: 'all' | TitleType): Title | null => {
  const name = entry.label?.trim();
  const description = entry.description?.trim() ?? '';
  const detectedType = inferMediaTypeFromDescription(description);
  if (!name || !detectedType || (requestedType !== 'all' && detectedType !== requestedType)) return null;

  const placeholder = coverArt(name, detectedType);
  return {
    id: `wikidata:${entry.id}`,
    name,
    type: detectedType,
    poster: placeholder,
    backdrop: placeholder,
    description,
    releaseYear: yearFromDescription(description),
    genres: [],
    rating: 0,
    runtime: '',
    cast: [],
    director: '',
    providers: [],
    source: { name: 'Wikidata', url: entry.concepturi ?? `https://www.wikidata.org/wiki/${entry.id}`, license: 'CC0' },
  };
};

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
      'Api-User-Agent': 'Ducere/1.0 (https://github.com/sapanaparam03-bot/Ducere)',
    },
  });
  if (!response.ok) {
    if (response.status === 429) throw new Error('The open catalogue source is busy. Please wait a moment and try again.');
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

async function searchWikidata(query: string, type: 'all' | TitleType, signal: AbortSignal): Promise<Title[]> {
  const params = new URLSearchParams({
    action: 'wbsearchentities', search: query, language: 'en', uselang: 'en',
    type: 'item', limit: '20', format: 'json', origin: '*',
  });
  const url = `https://www.wikidata.org/w/api.php?${params.toString()}`;
  const result = await withTimeout((requestSignal) => fetchJson<WikidataSearchResponse>(url, requestSignal), signal);
  return (result.search ?? []).map((entry) => mapWikidataResult(entry, type))
    .filter((title): title is Title => Boolean(title)).slice(0, 20);
}

let activeSearchController: AbortController | null = null;
export function cancelExternalCatalogueSearch() {
  activeSearchController?.abort();
  activeSearchController = null;
}

/** User-initiated Wikidata lookup only. Structured data is CC0; no other catalogue API, scraping, bulk import, rating, or artwork source is used. */
export async function searchExternalCatalogue(query: string, type: 'all' | TitleType = 'all'): Promise<Title[]> {
  const normalized = query.trim();
  if (normalized.length < 2) return [];
  cancelExternalCatalogueSearch();
  const controller = new AbortController();
  activeSearchController = controller;
  try {
    const titles = await searchWikidata(normalized, type, controller.signal);
    const unique = deduplicateCatalogueTitles(titles);
    if (controller.signal.aborted) throw new DOMException('Search cancelled', 'AbortError');
    return unique.slice(0, 30);
  } finally {
    if (activeSearchController === controller) activeSearchController = null;
  }
}
