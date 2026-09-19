import type { Provider, TitleType } from './ducere';

const token = import.meta.env.VITE_TMDB_READ_TOKEN as string | undefined;
const defaultRegion = (import.meta.env.VITE_TMDB_REGION as string | undefined) || 'IN';

const REGION_ALIASES: Record<string, string> = {
  'United States': 'US', 'India': 'IN', 'Canada': 'CA', 'United Kingdom': 'GB',
  'Australia': 'AU', 'New Zealand': 'NZ', 'Japan': 'JP', 'South Korea': 'KR',
  'Singapore': 'SG', 'United Arab Emirates': 'AE', 'Germany': 'DE', 'France': 'FR',
  'Spain': 'ES', 'Italy': 'IT', 'Netherlands': 'NL', 'Sweden': 'SE',
  'Brazil': 'BR', 'Mexico': 'MX',
};

const normalizeRegion = (region: string) => REGION_ALIASES[region] ?? region.trim().toUpperCase();
const base = 'https://api.themoviedb.org/3';
const img = (path: string | null | undefined, size = 'w500') => path ? `https://image.tmdb.org/t/p/${size}${path}` : '';

const tmdbFetch = async <T,>(path: string): Promise<T> => {
  if (!token) throw new Error('TMDB is not configured');
  const response = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}`, accept: 'application/json' } });
  if (!response.ok) throw new Error(`TMDB ${response.status}`);
  return response.json() as Promise<T>;
};

type SearchResponse = { results?: Array<{ id: number; media_type?: string }> };
export type WatchProviderResponse = { results: Record<string, { flatrate?: ProviderRow[]; free?: ProviderRow[]; rent?: ProviderRow[]; buy?: ProviderRow[]; link?: string }> };
type ProviderRow = { provider_id: number; provider_name: string; logo_path: string | null; display_priority: number };

export async function fetchWatchProvidersByTitle(name: string, type: TitleType, region = defaultRegion, titleId?: string): Promise<Provider[]> {
  const market = normalizeRegion(region);
  if (!token || !name.trim()) return [];
  try {
    const media = type === 'movie' ? 'movie' : 'tv';
    const tmdbId = titleId?.match(/^tmdb-(movie|tv)-(\\d+)$/)?.[2];
    const matchId = tmdbId ?? (await tmdbFetch<SearchResponse>(`/search/${media}?query=${encodeURIComponent(name)}&include_adult=false&language=en-US&page=1`)).results?.[0]?.id;
    if (!matchId) return [];
    const data = await tmdbFetch<WatchProviderResponse>(`/${media}/${matchId}/watch/providers`);
    return providerRows(data, market);
  } catch { return []; }
}

export function providerRows(data: WatchProviderResponse | null, region = defaultRegion): Provider[] {
  const market = normalizeRegion(region);
  const row = data?.results?.[market];
  if (!row) return [];
  const groups: Array<[ProviderRow[] | undefined, Provider['kind']]> = [[row.flatrate, 'streaming'], [row.free, 'free'], [row.rent, 'rent'], [row.buy, 'buy']];
  return groups.flatMap(([items, kind]) => (items ?? []).map((item) => ({ name: item.provider_name, kind, logo: img(item.logo_path, 'w92'), url: row.link }))).filter((item, index, all) => all.findIndex((x) => x.name === item.name && x.kind === item.kind) === index);
}
