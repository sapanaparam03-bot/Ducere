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


const tmdbToken = import.meta.env.VITE_TMDB_READ_TOKEN as string | undefined;
const tmdbImage = (path: string | null | undefined, size = 'w500') => path ? `https://image.tmdb.org/t/p/${size}${path}` : '';

type TmdbMedia = {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  genre_ids?: number[];
  media_type?: 'movie' | 'tv';
};

type TmdbTrending = { results?: TmdbMedia[] };

const tmdbFetch = async <T,>(path: string): Promise<T> => {
  if (!tmdbToken) throw new Error('TMDB is not configured');
  const response = await fetch(`https://api.themoviedb.org/3${path}`, {
    headers: { Authorization: `Bearer ${tmdbToken}`, accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`TMDB catalog source returned ${response.status}`);
  return response.json() as Promise<T>;
};

const tmdbTitle = (item: TmdbMedia): Title => {
  const type = item.media_type === 'movie' ? 'movie' : 'tv';
  const name = item.title ?? item.name ?? 'Untitled';
  const date = item.release_date ?? item.first_air_date;
  return {
    id: `tmdb-${type}-${item.id}`,
    name,
    type,
    poster: tmdbImage(item.poster_path) || coverArt(name, type),
    backdrop: tmdbImage(item.backdrop_path, 'w1280') || coverArt(name, type),
    description: item.overview?.trim() || 'A title from the live TMDB catalog.',
    releaseYear: yearFrom(date),
    genres: type === 'movie' ? ['Movie'] : ['Series'],
    rating: Math.round((item.vote_average ?? 0) * 10) / 10,
    runtime: type === 'movie' ? 'Movie' : 'Series',
    cast: [],
    director: 'TMDB catalog',
    providers: [],
  };
};

const CACHE_KEY = 'ducere-live-catalog-v2';
const CACHE_TTL = 1000 * 60 * 60 * 12;

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
    poster: coverArt(show.name, 'tv'),
    backdrop: coverArt(show.name, 'tv'),
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
    poster: coverArt(anime.title, 'anime'),
    backdrop: coverArt(anime.title, 'anime'),
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
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Catalog source returned ${response.status}`);
  return response.json() as Promise<T>;
};

export async function loadLiveCatalog(): Promise<Title[]> {
  const cached = readCache();
  if (cached?.length) return cached;

  const [tmdbResult, tvResult, animeResult] = await Promise.allSettled([
    tmdbToken
      ? tmdbFetch<TmdbTrending>('/trending/all/week?language=en-US')
      : Promise.resolve({ results: [] } as TmdbTrending),
    Promise.all(
      Array.from({ length: 5 }, (_, page) =>
        fetchJson<TvMazeShow[]>(`https://api.tvmaze.com/shows?page=${page}`),
      ),
    ),
    fetchJson<{ data?: JikanAnime[] }>('https://api.jikan.moe/v4/top/anime?limit=25'),
  ]);

  const tmdb = tmdbResult.status === 'fulfilled' ? tmdbResult.value : { results: [] };
  const tvPages = tvResult.status === 'fulfilled' ? tvResult.value : [];
  const animePage = animeResult.status === 'fulfilled' ? animeResult.value : { data: [] };

  const remoteTitles = [
    ...(tmdb.results ?? [])
      .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
      .map(tmdbTitle),
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
