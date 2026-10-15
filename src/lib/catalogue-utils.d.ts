export function normalizeCatalogName(value: unknown): string;
export function inferMediaTypeFromDescription(description: unknown): 'movie' | 'tv' | 'anime' | null;
export function deduplicateCatalogueTitles<T extends { id: string; name: string; type: string; releaseYear?: number }>(titles: T[]): T[];
export function mergeCatalogueTitles<T extends { id: string }>(baseTitles: T[], selectedTitles: T[], currentTitles: T[], incomingTitles: T[], maxRecent?: number): T[];
