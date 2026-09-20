export type TitleType = 'movie' | 'tv' | 'anime';
export type UserStatus = 'watchlist' | 'watching' | 'watched';
export type ProviderKind = 'streaming' | 'free' | 'rent' | 'buy' | 'info';

export type Provider = { name: string; kind: ProviderKind; url?: string; logo?: string };
export type Title = {
  id: string; name: string; type: TitleType; poster: string; backdrop: string;
  description: string; releaseYear: number; genres: string[]; rating: number;
  runtime: string; cast: string[]; director: string; seasons?: number; episodes?: number;
  providers: Provider[];
};
export type UserTitle = {
  titleId: string; status: UserStatus; dateAdded: string; dateWatched?: string;
  rating?: number; review?: string; currentSeason?: number; currentEpisode?: number; progress?: number;
};
export type Profile = { username: string; country: string; appearance: 'night' | 'day'; onboardingComplete: boolean; };

const escapeSvgText = (value: string) => value.replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' })[character] ?? character);