export type SubscriptionProvider = {
  key: string;
  name: string;
  aliases: string[];
  kind: 'streaming';
};

export const SUBSCRIPTION_PROVIDERS: SubscriptionProvider[] = [
  { key: 'netflix', name: 'Netflix', aliases: ['netflix'], kind: 'streaming' },
  { key: 'prime-video', name: 'Prime Video', aliases: ['prime video', 'amazon prime video', 'amazon'], kind: 'streaming' },
  { key: 'disney-plus', name: 'Disney+', aliases: ['disney+', 'disney plus'], kind: 'streaming' },
  { key: 'jiohotstar', name: 'JioHotstar', aliases: ['jiohotstar', 'hotstar'], kind: 'streaming' },
  { key: 'crunchyroll', name: 'Crunchyroll', aliases: ['crunchyroll'], kind: 'streaming' },
  { key: 'apple-tv-plus', name: 'Apple TV+', aliases: ['apple tv+', 'apple tv plus'], kind: 'streaming' },
  { key: 'max', name: 'Max', aliases: ['max', 'hbo max'], kind: 'streaming' },
  { key: 'hulu', name: 'Hulu', aliases: ['hulu'], kind: 'streaming' },
  { key: 'peacock', name: 'Peacock', aliases: ['peacock'], kind: 'streaming' },
  { key: 'paramount-plus', name: 'Paramount+', aliases: ['paramount+', 'paramount plus'], kind: 'streaming' },
  { key: 'sony-liv', name: 'Sony LIV', aliases: ['sony liv', 'sonyliv'], kind: 'streaming' },
  { key: 'zee5', name: 'ZEE5', aliases: ['zee5'], kind: 'streaming' },
  { key: 'youtube', name: 'YouTube', aliases: ['youtube'], kind: 'streaming' },
  { key: 'google-tv', name: 'Google TV', aliases: ['google tv'], kind: 'streaming' },
];

export const providerKeyForName = (name: string) => {
  const normalized = name.toLowerCase().replace(/\s+/g, ' ').trim();
  return SUBSCRIPTION_PROVIDERS.find((provider) => provider.aliases.some((alias) => normalized.includes(alias)))?.key;
};
