import { coverArt, TITLES, type Title } from './ducere';

type TvMazeShow = {
  id: number;
  name: string;
  genres?: string[];
  rating?: { average?: number | null };
  image?: { medium?: string | null; original?: string | null } | null;
  summary?: string | null;
  premiered?: string | null;
  runtime?: number | null;
  language?: string | null;
  network?: { name?: string | null } | null;
  webChannel?: { name?: string | null } | null;
};

type JikanAnime = {
  mal_id: number;
  title: string;
  images?: { jpg?: { large_image_url?: string | null; image_url?: string | null } };
  synopsis?: string | null;
  aired?: { from?: string | null };
  score?: number | null;
  episodes?: number | null;
  genres?: { name: string }[];
  studios?: { name: string }[];
};


const CACHE_KEY = 'ducere-live-catalog-v4';
const CACHE_TTL = 1000 * 60 * 60 * 24;

const stripMarkup = (value: string | null | undefined) =>
  (value ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

const yearFrom = (value: string | null | undefined) => {
  const year = Number(value?.slice(0, 4));
  return Number.isFinite(year) ? year : 0;
};

const tvMazeTitle = (show: TvMazeShow): Title => {
  const provider = show.network?.name ?? show.webChannel?.name ?? (show.language ? `${show.language} catalog` : 'TVMaze catalog');
  return {
    id: `tvmaze-${show.id}`,
    name: show.name,
    type: 'tv',
    poster: show.image?.original ?? show.image?.medium ?? coverArt(show.name, 'tv'),
    backdrop: show.image?.original ?? show.image?.medium ?? coverArt(show.name, 'tv'),
    description: stripMarkup(show.summary) || 'A series from the live Ducere catalog.',
    releaseYear: yearFrom(show.premiered),
    genres: show.genres?.length ? show.genres : ['Series'],
    rating: Math.round((show.rating?.average ?? 0) * 10) / 10,
    runtime: show.runtime ? `${show.runtime} min episodes` : 'Series',
    cast: ['Cast information available in the live catalog'],
    director: 'TVMaze catalog',
    seasons: 1,
    episodes: 0,
    providers: [{ name: `${provider} · catalog reference`, kind: 'info' }],
  };
};

const jikanTitle = (anime: JikanAnime): Title => {
  return {
    id: `jikan-${anime.mal_id}`,
    name: anime.title,
    type: 'anime',
    poster: anime.images?.jpg?.large_image_url ?? anime.images?.jpg?.image_url ?? coverArt(anime.title, 'anime'),
    backdrop: anime.images?.jpg?.large_image_url ?? anime.images?.jpg?.image_url ?? coverArt(anime.title, 'anime'),
    description: anime.synopsis?.trim() || 'An anime title from the live Ducere catalog.',
    releaseYear: yearFrom(anime.aired?.from),
    genres: anime.genres?.map((genre) => genre.name).slice(0, 4) ?? ['Anime'],
    rating: Math.round(Math.min(anime.score ?? 0, 10) * 10) / 10,
    runtime: anime.episodes ? `${anime.episodes} episodes` : 'Series',
    cast: ['Cast information available in the live catalog'],
    director: anime.studios?.[0]?.name ?? 'MyAnimeList catalog',
    seasons: 1,
    episodes: anime.episodes ?? 0,
    providers: [{ name: 'MyAnimeList · catalog reference', kind: 'info' }],
  };
};

const readCache = (): Title[] | null => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; titles: Title[] };
    return Date.now() - parsed.savedAt < CACHE_TTL ? parsed.titles : null;
  } catch {
    return null;
  }
};

const writeCache = (titles: Title[]) => {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), titles }));
  } catch {
    // A full cache is optional; the live catalog remains usable without it.
  }
};

const fetchJson = async <T,>(url: string): Promise<T> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Catalog source returned ${response.status}`);
    return response.json() as Promise<T>;
  } finally {
    window.clearTimeout(timeout);
  }
};

export async function loadLiveCatalog(): Promise<Title[]> {
  const cached = readCache();
  if (cached?.length) return cached;

  const [tvResult, animeResult] = await Promise.allSettled([
    Promise.all(
      Array.from({ length: 3 }, (_, page) =>
        fetchJson<TvMazeShow[]>(`https://api.tvmaze.com/shows?page=${page}`),
      ),
    ),
    fetchJson<{ data?: JikanAnime[] }>('https://api.jikan.moe/v4/top/anime?limit=30'),
  ]);

  const tvPages = tvResult.status === 'fulfilled' ? tvResult.value : [];
  const animePage = animeResult.status === 'fulfilled' ? animeResult.value : { data: [] };

  const remoteTitles = [
    ...tvPages.flat().map(tvMazeTitle),
    ...(animePage.data ?? []).map(jikanTitle),
  ];

  const seen = new Set<string>();
  const merged = [...TITLES, ...remoteTitles].filter((title) => {
    if (seen.has(title.id)) return false;
    seen.add(title.id);
    return true;
  });
  writeCache(merged);
  return merged;
}
