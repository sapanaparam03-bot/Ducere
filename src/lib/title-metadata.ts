import type { Title } from './ducere';

type TvMazeSearchResult = {
  show?: {
    id: number;
    name?: string;
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

const normalizeTitle = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const tvMazeImage = async (title: Title) => {
  const query = encodeURIComponent(title.name);
  const results = await fetchWithTimeout<TvMazeSearchResult[]>(`https://api.tvmaze.com/search/shows?q=${query}`);
  const exact = results.find((entry) => normalizeTitle(entry.show?.name ?? '') === normalizeTitle(title.name));
  return exact?.show?.image?.original ??
    exact?.show?.image?.medium ??
    results[0]?.show?.image?.original ??
    results[0]?.show?.image?.medium ??
    null;
};

const tvMazeSeasons = async (title: Title) => {
  const id = title.id.match(/^tvmaze-(\d+)$/)?.[1];
  const showId = id ?? (
    await fetchWithTimeout<TvMazeSearchResult[]>(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title.name)}`)
  )[0]?.show?.id?.toString();
  if (!showId) return {};

  const seasons = await fetchWithTimeout<TvMazeSeason[]>(`https://api.tvmaze.com/shows/${showId}/seasons`);
  const valid = seasons.filter((season) => Number.isFinite(season.number ?? NaN));
  const poster = await tvMazeImage(title).catch(() => null);
  return {
    ...(poster ? { poster, backdrop: poster } : {}),
    seasons: valid.length || title.seasons || 1,
    episodes: title.episodes || valid.reduce((sum, season) => sum + (season.episodeOrder ?? 0), 0) || 0,
  };
};

const aniListMedia = async (title: Title) => {
  const idMal = title.id.match(/^jikan-(\d+)$/)?.[1];
  const query = `query ($id: Int, $idMal: Int, $search: String) {
    Media(id: $id, idMal: $idMal, search: $search, type: ANIME) {
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
  const aliases: Record<string, string> = {
    'demon slayer': 'Kimetsu no Yaiba',
    'demon-slayer': 'Kimetsu no Yaiba',
  };
  const search = aliases[normalizeTitle(title.name)] ?? title.name;
  const body = {
    query,
    variables: idMal ? { idMal: Number(idMal) } : { search },
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

  const directTvRelations = (media.relations?.edges ?? []).filter(
    (edge) => (edge.relationType === 'SEQUEL' || edge.relationType === 'PREQUEL') &&
      (edge.node?.format === 'TV' || edge.node?.format === 'TV_SHORT'),
  );

  const connectedIds = new Set<number>();
  for (const edge of directTvRelations) {
    if (edge.node?.id) connectedIds.add(edge.node.id);
  }

  // Anime seasons are commonly represented by separate TV entries linked by
  // prequel/sequel relations. Walk the sequel chain a few steps so titles such
  // as Demon Slayer can reflect multiple TV seasons without loading this at startup.
  let currentId = directTvRelations.find((edge) => edge.relationType === 'SEQUEL')?.node?.id;
  for (let depth = 0; currentId && depth < 10; depth++) {
    const linked = await fetchWithTimeout<AniListResponse>(`https://graphql.anilist.co`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        query: `query ($id: Int) {
          Media(id: $id, type: ANIME) {
            id
            relations {
              edges {
                relationType
                node {
                  id
                  format
                  title { romaji english }
                }
              }
            }
          }
        }`,
        variables: { id: currentId },
      }),
    }).catch(() => null);
    const next = linked?.data?.Media?.relations?.edges?.find(
      (edge) => edge.relationType === 'SEQUEL' &&
        (edge.node?.format === 'TV' || edge.node?.format === 'TV_SHORT') &&
        edge.node?.id,
    )?.node?.id;
    if (!next || connectedIds.has(next)) break;
    connectedIds.add(next);
    currentId = next;
  }

  const poster =
    media.coverImage?.extraLarge ??
    media.coverImage?.large ??
    directTvRelations.map((edge) => edge.node?.coverImage?.extraLarge ?? edge.node?.coverImage?.large).find(Boolean) ??
    null;

  const inferredSeasons = Math.max(1, connectedIds.size + 1);

  return {
    ...(poster ? { poster, backdrop: poster } : {}),
    ...(media.episodes ? { episodes: media.episodes } : {}),
    seasons: title.seasons && title.seasons > 1 ? Math.max(title.seasons, inferredSeasons) : inferredSeasons,
  };
};

const wikipediaArtwork = async (title: string) => {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: title,
    gsrnamespace: '0',
    gsrlimit: '1',
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: '600',
    format: 'json',
    origin: '*',
  });
  try {
    const json = await fetchWithTimeout<{ query?: { pages?: Record<string, { thumbnail?: { source?: string } }> } }>(
      `https://en.wikipedia.org/w/api.php?${params.toString()}`,
    );
    return Object.values(json.query?.pages ?? {})[0]?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
};

export async function resolvePosterFallback(title: Title): Promise<string | null> {
  const key = `poster:${title.id}`;
  const cached = metadataCache.get(key);
  if (cached?.poster) return cached.poster;

  let poster: string | null = null;
  try {
    if (title.type === 'tv') {
      poster = await tvMazeImage(title);
    } else if (title.type === 'anime') {
      const result = await aniListMedia(title);
      poster = result.data?.Media?.coverImage?.extraLarge ?? result.data?.Media?.coverImage?.large ?? null;
    } else {
      poster = await wikipediaArtwork(title.name);
    }
  } catch {
    poster = null;
  }

  if (!poster) poster = await wikipediaArtwork(title.name);
  metadataCache.set(key, poster ? { poster } : {});
  return poster;
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
