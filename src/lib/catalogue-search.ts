import { coverArt, type Title } from './ducere';

type TvMazeSearchEntry = {
  score?: number;
  show?: {
    id: number;
    name: string;
    url?: string;
    genres?: string[];
    rating?: { average?: number | null };
    image?: { medium?: string | null; original?: string | null } | null;
    summary?: string | null;
    premiered?: string | null;
    ended?: string | null;
    runtime?: number | null;
    averageRuntime?: number | null;
    language?: string | null;
    network?: { name?: string | null } | null;
    webChannel?: { name?: string | null } | null;
  } | null;
};

const stripMarkup = (value: string | null | undefined) =>
  (value ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

const yearFrom = (value: string | null | undefined) => {
  const year = Number(value?.slice(0, 4));
  return Number.isFinite(year) && year > 1800 ? year : 0;
};

const mapTvMazeResult = (entry: TvMazeSearchEntry): Title | null => {
  const show = entry.show;
  if (!show?.id || !show.name?.trim()) return null;
  const poster = show.image?.original ?? show.image?.medium ?? coverArt(show.name, 'tv');
  const broadcaster = show.network?.name ?? show.webChannel?.name;
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
    director: 'TVmaze',
    seasons: undefined,
    episodes: undefined,
    providers: [],
    source: {
      name: 'TVmaze',
      url: show.url ?? `https://www.tvmaze.com/shows/${show.id}`,
      license: 'CC BY-SA',
    },
  };
};

async function fetchJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) {
    if (response.status === 429) throw new Error('The series catalogue is busy. Please wait a moment and try again.');
    throw new Error(`Series search failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

/**
 * User-initiated, on-demand TV-series search. This deliberately does not crawl
 * the provider's full catalogue or permanently store provider data in browser storage.
 * TVmaze data is CC BY-SA; results carry a source link for attribution.
 */
export async function searchExternalSeries(query: string): Promise<Title[]> {
  const normalized = query.trim();
  if (normalized.length < 2) return [];

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 7000);
  try {
    const url = `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(normalized)}`;
    const entries = await fetchJson<TvMazeSearchEntry[]>(url, controller.signal);
    const seen = new Set<string>();
    return entries
      .map(mapTvMazeResult)
      .filter((title): title is Title => {
        if (!title || seen.has(title.id)) return false;
        seen.add(title.id);
        return true;
      })
      .slice(0, 20);
  } finally {
    window.clearTimeout(timeout);
  }
}
