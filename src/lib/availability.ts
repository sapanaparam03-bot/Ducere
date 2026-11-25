import type { Title } from './ducere';

/**
 * No external streaming-availability provider is used.
 * The replacement is Ducere's own community catalogue. Until its reviewed
 * database and moderation workflow are deployed, return no confirmed listings.
 */
export type AvailabilitySource = {
  name: string;
  kind: 'streaming' | 'free' | 'rent' | 'buy' | 'info';
  url?: string;
  region: string;
  status: 'pending' | 'verified' | 'contested' | 'expired';
  lastVerifiedAt?: string;
};
export type AvailabilityResult = {
  titleId: string;
  titleName: string;
  region: string;
  sources: AvailabilitySource[];
  status: 'community_catalogue_unavailable';
};

export async function getTitleAvailability(title: Title, region: string): Promise<AvailabilityResult> {
  const normalizedRegion = (region || 'IN').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalizedRegion)) throw new Error('Choose a valid two-letter country code in Settings.');
  return {
    titleId: title.id,
    titleName: title.name,
    region: normalizedRegion,
    sources: [],
    status: 'community_catalogue_unavailable',
  };
}
