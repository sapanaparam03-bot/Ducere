import type { Title } from './ducere';

type TvMazeSearchResult = {
  show?: {
    id: number;
    image?: { original?: string | null; medium?: string | null } | null;
  };
};

type TvMazeSeason = {
  id: number;
  number?: number | null;
  episodeOrder?: number | null;
};

type AniListResponse = {
  data?: {
    Media?: {
      id: number;
      episodes?: number | null;
      coverImage?: { extraLarge?: string | null; large?: string | null } | null;
      relations?: {
        edges?: Array<{
          relationType?: string;
          node?: {
            id: number;
            format?: string | null;
            title?: { romaji?: string | null; english?: string | null };
            coverImage?: { extraLarge?: string | null; large?: string | null } | null;
          } | null;
        }>;
      };
    } | null;
  };
};

const metadataCache = new Map<string, Partial<Title>>();

const fetchWithTimeout = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`Metadata request returned ${response.status}`);
    return response.json() as Promise<T>;
  } finally {
    window.clearTimeout(timer);
  }
};

const tvMazeImage = async (title: Title) => {
  const query = encodeURIComponent(title.name);
  const results = await fetchWithTimeout<TvMazeSearchResult[]>(`https://api.tvmaze.com/search/shows?q=${query}`);
  return results[0]?.show?.image?.original ?? results[0]?.show?.image?.medium ?? null;
};

const tvMazeSeasons = async (title: Title) => {
  const id = title.id.match(/^tvmaze-(\d+)$/)?.[1];
  const showId = id ?? (
    await fetchWithTimeout<TvMazeSearchResult[]>(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title.name)}`)
  )[0]?.show?.id?.toString();
  if (!showId) return {};

  const seasons = await fetchWithTimeout<TvMazeSeason[]>(`https://api.tvmaze.com/shows/${showId}/seasons`);
  const valid = seasons.filter((season) => Number.isFinite(season.number ?? NaN));
  return {
    seasons: valid.length || title.seasons || 1,
    episodes: title.episodes || valid.reduce((sum, season) => sum + (season.episodeOrder ?? 0), 0) || 0,
  };
};

const aniListMedia = async (title: Title) => {
  const idMal = title.id.match(/^jikan-(\d+)$/)?.[1];
  const query = `query ($idMal: Int, $search: String) {
    Media(idMal: $idMal, search: $search, type: ANIME) {
      id
      episodes
      coverImage { extraLarge large }
      relations {
        edges {
          relationType
          node {
            id
            format
            title { romaji english }
            coverImage { extraLarge large }
          }
        }
      }
    }
  }`;
  const body = {
    query,
    variables: idMal ? { idMal: Number(idMal) } : { search: title.name },
  };
  return fetchWithTimeout<AniListResponse>('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
};

const aniListMetadata = async (title: Title) => {
  const result = await aniListMedia(title);
  const media = result.data?.Media;
  if (!media) return {};

  const linkedSeries = (media.relations?.edges ?? []).filter(
    (edge) => (edge.relationType === 'SEQUEL' || edge.relationType === 'PREQUEL') &&
      (edge.node?.format === 'TV' || edge.node?.format === 'TV_SHORT'),
  );

  const poster =
    media.coverImage?.extraLarge ??
    media.coverImage?.large ??
    linkedSeries.map((edge) => edge.node?.coverImage?.extraLarge ?? edge.node?.coverImage?.large).find(Boolean) ??
    null;

  // AniList represents many anime seasons as separate TV entries linked as
  // prequels/sequels. This is a best-effort franchise count; curated titles
  // retain their explicit season data.
  const inferredSeasons = Math.max(1, 1 + linkedSeries.length);

  return {
    ...(poster ? { poster, backdrop: poster } : {}),
    ...(media.episodes ? { episodes: media.episodes } : {}),
    seasons: title.seasons && title.seasons > 1 ? title.seasons : inferredSeasons,
  };
};

export async function resolvePosterFallback(title: Title): Promise<string | null> {
  const key = `poster:${title.id}`;
  const cached = metadataCache.get(key);
  if (cached?.poster) return cached.poster;

  try {
    let poster: string | null = null;
    if (title.type === 'tv') poster = await tvMazeImage(title);
    else if (title.type === 'anime') {
      const result = await aniListMedia(title);
      poster = result.data?.Media?.coverImage?.extraLarge ?? result.data?.Media?.coverImage?.large ?? null;
    } else {
      const params = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: title.name,
        gsrnamespace: '0',
        gsrlimit: '1',
        prop: 'pageimages',
        piprop: 'thumbnail',
        pithumbsize: '600',
        format: 'json',
        origin: '*',
      });
      const json = await fetchWithTimeout<{ query?: { pages?: Record<string, { thumbnail?: { source?: string } }> } }>(
        `https://en.wikipedia.org/w/api.php?${params.toString()}`,
      );
      poster = Object.values(json.query?.pages ?? {})[0]?.thumbnail?.source ?? null;
    }
    metadataCache.set(key, poster ? { poster } : {});
    return poster;
  } catch {
    return null;
  }
}

export async function getTitleMetadata(title: Title): Promise<Partial<Title>> {
  const key = `meta:${title.id}`;
  const cached = metadataCache.get(key);
  if (cached) return cached;

  try {
    const result = title.type === 'tv'
      ? await tvMazeSeasons(title)
      : title.type === 'anime'
        ? await aniListMetadata(title)
        : {};
    metadataCache.set(key, result);
    return result;
  } catch {
    return {};
  }
}
