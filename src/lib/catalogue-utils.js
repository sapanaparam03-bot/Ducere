export function normalizeCatalogName(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function inferMediaTypeFromDescription(description) {
  const value = String(description ?? '');
  if (/\b(anime|Japanese animated)\b/i.test(value) &&
      /\b(series|film|movie|animation|television)\b/i.test(value)) return 'anime';
  if (/\b(television series|tv series|television show|television program|sitcom)\b/i.test(value)) return 'tv';
  if (/\b(film|movie|motion picture)\b/i.test(value)) return 'movie';
  return null;
}

export function deduplicateCatalogueTitles(titles) {
  const unique = [];
  const seenIds = new Set();
  const seenKeys = new Set();
  for (const title of titles) {
    if (!title || typeof title.id !== 'string' || seenIds.has(title.id)) continue;
    seenIds.add(title.id);
    const name = normalizeCatalogName(title.name);
    const year = Number(title.releaseYear) || 0;
    const key = `${title.type}\u0000${name}\u0000${year}`;
    const wildcardKey = `${title.type}\u0000${name}\u0000*`;
    if (seenKeys.has(key) || (year && seenKeys.has(wildcardKey))) continue;
    if (!year && [...seenKeys].some((candidate) => candidate.startsWith(`${title.type}\u0000${name}\u0000`))) continue;
    seenKeys.add(key);
    if (!year) seenKeys.add(wildcardKey);
    unique.push(title);
  }
  return unique;
}

export function mergeCatalogueTitles(baseTitles, selectedTitles, currentTitles, incomingTitles, maxRecent = 300) {
  const byId = new Map();
  for (const title of [...currentTitles, ...incomingTitles]) {
    if (!title || typeof title.id !== 'string') continue;
    byId.delete(title.id);
    byId.set(title.id, title);
  }

  const baseIds = new Set(baseTitles.map((title) => title.id));
  const selectedIds = new Set(selectedTitles.map((title) => title.id));
  const retained = [...byId.values()].filter((title) => !baseIds.has(title.id) && selectedIds.has(title.id));
  const recent = [...byId.values()].filter((title) => !baseIds.has(title.id) && !selectedIds.has(title.id));
  const recentLimit = Math.max(0, Math.floor(maxRecent));
  const boundedRecent = recentLimit === 0 ? [] : recent.slice(-recentLimit);
  return [...baseTitles, ...retained, ...boundedRecent];
}
