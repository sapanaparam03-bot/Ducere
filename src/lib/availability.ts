import type { Title } from './ducere';
import { supabase } from './supabase';
import {
  normalizeAvailabilityResult,
  readFreshCache,
  writeFreshCache,
  type NormalizedAvailabilityResult,
} from './availability-utils';

export type AvailabilitySource = NormalizedAvailabilityResult['sources'][number];
export type AvailabilityResult = NormalizedAvailabilityResult;

type CacheEntry<T> = { value: T; expiresAt: number };
const cache = new Map<string, CacheEntry<AvailabilityResult>>();

export async function getTitleAvailability(title: Title, region: string): Promise<AvailabilityResult> {
  const normalizedRegion = (region || 'US').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalizedRegion)) {
    throw new Error('Choose a valid two-letter country code in Settings.');
  }

  const key = `${title.id}:${normalizedRegion}`;
  const cached = readFreshCache(cache, key);
  if (cached) return cached;

  if (!supabase) {
    throw new Error('Availability service is not configured.');
  }

  const { data, error } = await supabase.functions.invoke('watchmode-availability', {
    body: {
      titleName: title.name,
      mediaType: title.type === 'movie' ? 'movie' : 'tv',
      year: title.releaseYear || undefined,
      region: normalizedRegion,
    },
  });

  if (error) throw error;

  const result = normalizeAvailabilityResult(data, normalizedRegion);
  writeFreshCache(cache, key, result);
  return result;
}
