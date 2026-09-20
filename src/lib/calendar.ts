import type { Title, UserTitle } from './ducere';

export type UpcomingEpisode = {
  titleId: string;
  titleName: string;
  episodeName: string;
  season: number;
  episode: number;
  airdate: string;
  airtime?: string;
  source: 'TVMaze';
};

type TvMazeEpisode = {
  id: number;
  name?: string | null;
  season?: number | null;
  number?: number | null;
  airdate?: string | null;
  airtime?: string | null;
  show?: { id?: number; name?: string | null } | null;
};

const cache = new Map<string, UpcomingEpisode[]>();

const fetchJson = async <T,>(url: string): Promise<T> => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Calendar source returned ${response.status}`);
    return response.json() as Promise<T>;
  } finally {
    window.clearTimeout(timer);
  }
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export async function getUpcomingEpisodes(userTitles: UserTitle[], catalog: Title[], region: string) {
  const watchingShows = userTitles
    .filter((item) => item.status === 'watching')
    .map((item) => catalog.find((title) => title.id === item.titleId))
    .filter((title): title is Title => Boolean(title && title.type === 'tv'));

  if (!watchingShows.length) return [];

  const key = `${region}:${watchingShows.map((show) => show.id).sort().join(',')}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const days = Array.from({ length: 14 }, (_, offset) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toISOString().slice(0, 10);
  });

  const results = await Promise.allSettled(
    days.map((date) => fetchJson<TvMazeEpisode[]>(`https://api.tvmaze.com/schedule?country=${encodeURIComponent(region)}&date=${date}`)),
  );

  const episodes = results.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
    .filter((episode) => episode.show?.name && episode.airdate)
    .flatMap((episode) => {
      const show = watchingShows.find((candidate) => normalize(candidate.name) === normalize(episode.show?.name ?? ''));
      if (!show || !episode.season || !episode.number || !episode.airdate) return [];
      return [{
        titleId: show.id,
        titleName: show.name,
        episodeName: episode.name ?? `Episode ${episode.number}`,
        season: episode.season,
        episode: episode.number,
        airdate: episode.airdate,
        airtime: episode.airtime ?? undefined,
        source: 'TVMaze' as const,
      }];
    })
    .sort((a, b) => `${a.airdate} ${a.airtime ?? ''}`.localeCompare(`${b.airdate} ${b.airtime ?? ''}`));

  cache.set(key, episodes);
  return episodes;
}
