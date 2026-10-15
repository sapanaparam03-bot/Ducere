import type { Profile, Title, UserStatus, UserTitle } from './ducere';

export type DucereBackup = {
  format: 'ducere-backup';
  version: 1;
  exportedAt: string;
  profile: Profile;
  titles: UserTitle[];
};

export type ImportSummary = {
  imported: number;
  skipped: number;
  invalid: number;
  message: string;
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const parseCsv = (text: string): Record<string, string>[] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
  }

  const headers = (rows.shift() ?? []).map((header) => header.trim().toLowerCase());
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, (values[index] ?? '').trim()])));
};

const rowToUserTitle = (row: Record<string, string>, catalog: Title[]): UserTitle | null => {
  const rawName = row['title'] || row['name'] || row['title name'] || row['anime title'] || '';
  if (!rawName) return null;

  const target = normalize(rawName);
  const year = Number(row['year'] || row['release year'] || '');
  const title = catalog.find((candidate) =>
    normalize(candidate.name) === target &&
    (!Number.isFinite(year) || !year || !candidate.releaseYear || Math.abs(candidate.releaseYear - year) <= 1)
  ) ?? catalog.find((candidate) => normalize(candidate.name) === target);

  if (!title) return null;

  const rawStatus = (row['status'] || '').toLowerCase();
  const watched = rawStatus.includes('completed') || rawStatus.includes('watched') ||
    Boolean(row['watched date'] || row['date watched'] || row['date rated']);
  const watching = rawStatus.includes('watching') || rawStatus.includes('currently watching');
  const status: UserStatus = watching ? 'watching' : watched ? 'watched' : 'watchlist';

  const ratingValue = Number(row['your rating'] || row['score'] || row['rating'] || '');
  const episodeValue = Number(row['episodes watched'] || row['episode'] || row['current episode'] || '');
  const seasonValue = Number(row['season'] || row['current season'] || '1');
  const rawProgress = row['progress']?.trim() ?? '';
  const progressValue = rawProgress ? Number(rawProgress) : Number.NaN;
  const rawDateAdded = row['date added'] || row['date'] || '';
  const rawDateWatched = row['watched date'] || row['date watched'] || row['date rated'] || '';
  const today = new Date().toISOString().slice(0, 10);

  return {
    titleId: title.id,
    status,
    dateAdded: isDateOnly(rawDateAdded) ? rawDateAdded : today,
    ...(watched ? {
      ...(isDateOnly(rawDateWatched) ? { dateWatched: rawDateWatched } : {}),
      progress: 100,
    } : {}),
    ...(Number.isFinite(ratingValue) && ratingValue > 0 ? { rating: Math.max(1, Math.min(5, Math.round(ratingValue > 5 ? ratingValue / 2 : ratingValue))) } : {}),
    ...(!watched && Number.isFinite(progressValue) ? { progress: Math.max(0, Math.min(100, progressValue)) } : {}),
    ...(Number.isFinite(episodeValue) && episodeValue > 0 && title.type !== 'movie' ? {
      currentEpisode: Math.floor(episodeValue),
      currentSeason: Math.max(1, Math.floor(Number.isFinite(seasonValue) ? seasonValue : 1)),
    } : {}),
  };
};

export function buildDucereBackup(profile: Profile, userTitles: UserTitle[]): DucereBackup {
  return {
    format: 'ducere-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    profile: {
      username: profile.username,
      country: profile.country,
      appearance: profile.appearance,
      onboardingComplete: profile.onboardingComplete,
      streamingServices: [...profile.streamingServices],
    },
    titles: userTitles.map((item) => ({ ...item })),
  };
}

export function downloadDucereBackup(profile: Profile, userTitles: UserTitle[]) {
  const backup = buildDucereBackup(profile, userTitles);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `ducere-backup-${date}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvCell = (value: string | number | undefined | null) => {
  const original = String(value ?? '');
  // Spreadsheet applications may execute cells beginning with formula characters.
  // Prefix an apostrophe even when whitespace/control characters precede the formula.
  const text = /^[\u0000-\u0020]*[=+@-]/.test(original) ? `'${original}` : original;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function downloadDucereCsv(userTitles: UserTitle[], catalog: Title[]) {
  const header = ['Title', 'Type', 'Year', 'Status', 'Date Added', 'Date Watched', 'Rating', 'Review', 'Season', 'Episode', 'Progress'];
  const rows = userTitles.map((item) => {
    const title = catalog.find((candidate) => candidate.id === item.titleId);
    return [
      csvCell(title?.name ?? item.titleId),
      csvCell(title?.type ?? ''),
      csvCell(title?.releaseYear ?? ''),
      csvCell(item.status),
      csvCell(item.dateAdded),
      csvCell(item.dateWatched),
      csvCell(item.rating),
      csvCell(item.review),
      csvCell(item.currentSeason),
      csvCell(item.currentEpisode),
      csvCell(item.progress),
    ].join(',');
  });
  // UTF-8 BOM helps spreadsheet applications preserve non-English title/review text.
  const blob = new Blob(['\uFEFF', [header.join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ducere-library-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const isDateOnly = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export function parseDucereBackup(text: string): DucereBackup {
  // Prevent accidental or malicious giant files from exhausting browser memory.
  if (text.length > 10_000_000) throw new Error('This backup is too large to import (maximum 10 MB).');
  let parsed: Partial<DucereBackup>;
  try {
    parsed = JSON.parse(text) as Partial<DucereBackup>;
  } catch {
    throw new Error('The backup file is not valid JSON.');
  }
  if (parsed.format !== 'ducere-backup' || parsed.version !== 1 || !parsed.profile || typeof parsed.profile !== 'object' || !Array.isArray(parsed.titles)) {
    throw new Error('This is not a valid Ducere backup file.');
  }
  if (parsed.titles.length > 50_000) throw new Error('This backup contains too many titles to import safely.');

  const today = new Date().toISOString().slice(0, 10);
  const byId = new Map<string, UserTitle>();
  for (const value of parsed.titles) {
    if (!value || typeof value !== 'object') continue;
    const item = value as Partial<UserTitle>;
    if (typeof item.titleId !== 'string' || !item.titleId.trim() || item.titleId.length > 256) continue;
    if (item.status !== 'watchlist' && item.status !== 'watching' && item.status !== 'watched') continue;

    const rating = typeof item.rating === 'number' && Number.isFinite(item.rating) && item.rating >= 1 && item.rating <= 5
      ? Math.round(item.rating)
      : undefined;
    const season = typeof item.currentSeason === 'number' && Number.isInteger(item.currentSeason) && item.currentSeason >= 1 && item.currentSeason <= 9999
      ? item.currentSeason
      : undefined;
    const episode = typeof item.currentEpisode === 'number' && Number.isInteger(item.currentEpisode) && item.currentEpisode >= 1 && item.currentEpisode <= 9999
      ? item.currentEpisode
      : undefined;
    const progress = typeof item.progress === 'number' && Number.isFinite(item.progress)
      ? Math.max(0, Math.min(100, item.progress))
      : undefined;
    const safe: UserTitle = {
      titleId: item.titleId.trim(),
      status: item.status,
      dateAdded: isDateOnly(item.dateAdded) ? item.dateAdded : today,
      ...(isDateOnly(item.dateWatched) ? { dateWatched: item.dateWatched } : {}),
      ...(rating !== undefined ? { rating } : {}),
      ...(typeof item.review === 'string' ? { review: item.review.slice(0, 5000) } : {}),
      ...(season !== undefined ? { currentSeason: season } : {}),
      ...(episode !== undefined ? { currentEpisode: episode } : {}),
      ...(progress !== undefined ? { progress } : {}),
    };
    byId.set(safe.titleId, safe);
  }

  const profile = parsed.profile;
  return {
    format: 'ducere-backup',
    version: 1,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt.slice(0, 64) : new Date().toISOString(),
    profile: {
      username: typeof profile.username === 'string' ? profile.username.trim().slice(0, 80) || 'Viewer' : 'Viewer',
      country: typeof profile.country === 'string' && /^[A-Za-z]{2}$/.test(profile.country) ? profile.country.toUpperCase() : 'IN',
      appearance: profile.appearance === 'day' ? 'day' : 'night',
      onboardingComplete: Boolean(profile.onboardingComplete),
      streamingServices: Array.isArray(profile.streamingServices)
        ? [...new Set(profile.streamingServices.filter((value): value is string => typeof value === 'string').map((value) => value.trim().slice(0, 80)).filter(Boolean))].slice(0, 100)
        : [],
    },
    titles: [...byId.values()],
  };
}

export function importCsvText(text: string, catalog: Title[]): { items: UserTitle[]; rows: number } {
  const rows = parseCsv(text);
  const items = rows.map((row) => rowToUserTitle(row, catalog)).filter((item): item is UserTitle => Boolean(item));
  return { items, rows: rows.length };
}

export const formatImportSummary = ({ imported, skipped, invalid }: { imported: number; skipped: number; invalid: number }) =>
  `Imported ${imported}. Skipped ${skipped} duplicate/unknown rows. ${invalid} invalid rows ignored.`;
