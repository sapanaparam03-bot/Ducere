import type { Title, Provider } from './ducere';
import { supabase } from './supabase';

export type AvailabilitySource = Provider & {
  sourceId?: number;
  region: string;
  verified: true;
};

export type AvailabilityResult = {
  titleId: number;
  titleName: string;
  sources: AvailabilitySource[];
  attributionRequired: boolean;
};

const cache = new Map<string, AvailabilityResult>();

export async function getTitleAvailability(title: Title, region: string): Promise<AvailabilityResult> {
  const key = `${title.id}:${region}`;
  const cached = cache.get(key);
  if (cached) return cached;

  if (!supabase) {
    throw new Error('Availability service is not configured.');
  }

  const { data, error } = await supabase.functions.invoke('watchmode-availability', {
    body: {
      titleName: title.name,
      mediaType: title.type === 'movie' ? 'movie' : 'tv',
      year: title.releaseYear || undefined,
      region: region || 'US',
    },
  });

  if (error) throw error;

  const result = data as AvailabilityResult;
  cache.set(key, result);
  return result;
}
