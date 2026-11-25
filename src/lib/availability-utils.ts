import type { Provider } from './ducere';

export type NormalizedAvailabilitySource = Provider & {
  sourceId?: number;
  region: string;
  verified: true;
};

export type NormalizedAvailabilityResult = {
  titleId: number;
  titleName: string;
  sources: NormalizedAvailabilitySource[];
  attributionRequired: boolean;
};

type CacheEntry<T> = { value: T; expiresAt: number };

export const AVAILABILITY_CACHE_TTL_MS = 15 * 60 * 1000;
export const AVAILABILITY_CACHE_MAX_ENTRIES = 300;

export function readFreshCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  now = Date.now(),
): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

export function writeFreshCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  now = Date.now(),
  ttlMs = AVAILABILITY_CACHE_TTL_MS,
  maxEntries = AVAILABILITY_CACHE_MAX_ENTRIES,
): void {
  for (const [entryKey, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(entryKey);
  }
  cache.delete(key);
  while (cache.size >= maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
  cache.set(key, { value, expiresAt: now + ttlMs });
}

const providerKind = (value: unknown): Provider['kind'] => {
  const kind = String(value ?? '').trim().toLowerCase();
  if (['sub', 'subscription', 'streaming'].includes(kind)) return 'streaming';
  if (['free', 'ads', 'ad-supported'].includes(kind)) return 'free';
  if (['rent', 'rental'].includes(kind)) return 'rent';
  if (['buy', 'purchase', 'buy/rent'].includes(kind)) return 'buy';
  return 'info';
};

export function normalizeAvailabilityResult(data: unknown, requestedRegion: string): NormalizedAvailabilityResult {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Availability service returned an invalid response.');
  }

  const value = data as Record<string, unknown>;
  if (!Array.isArray(value.sources)) {
    throw new Error('Availability service returned an invalid sources list.');
  }

  const region = requestedRegion.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(region)) {
    throw new Error('A valid two-letter region is required.');
  }

  const sources = value.sources.flatMap((item): NormalizedAvailabilitySource[] => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const source = item as Record<string, unknown>;
    const name = typeof source.name === 'string' ? source.name.trim() : '';
    if (!name) return [];

    let url: string | undefined;
    if (typeof source.web_url === 'string') {
      try {
        const parsed = new URL(source.web_url);
        if (parsed.protocol === 'https:') url = parsed.toString();
      } catch {
        // Invalid provider links are omitted rather than rendered as clickable URLs.
      }
    }

    const sourceId = Number(source.source_id);
    return [{
      name,
      kind: providerKind(source.type),
      ...(url ? { url } : {}),
      ...(Number.isSafeInteger(sourceId) && sourceId > 0 ? { sourceId } : {}),
      region,
      verified: true,
    }];
  });

  const titleId = Number(value.titleId);
  const titleName = typeof value.titleName === 'string' ? value.titleName.trim() : '';
  return {
    titleId: Number.isSafeInteger(titleId) && titleId >= 0 ? titleId : 0,
    titleName,
    sources,
    attributionRequired: value.attributionRequired !== false,
  };
}
