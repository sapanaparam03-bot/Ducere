import { useCallback, useEffect, useRef, useState } from 'react';
import { TITLES, type Title, type TitleType } from '@/lib/ducere';
import { loadLiveCatalog } from '@/lib/live-catalog';
import { searchExternalCatalogue } from '@/lib/catalogue-search';

const SELECTED_TITLES_KEY = 'ducere-selected-catalogue-v1';

const isSelectedTitle = (item: unknown): item is Title => {
  if (!item || typeof item !== 'object') return false;
  const title = item as Partial<Title>;
  const validId = typeof title.id === 'string' &&
    (title.id.startsWith('tvmaze-') || title.id.startsWith('wikidata-'));
  const validSource = Boolean(title.source && typeof title.source.name === 'string' &&
    typeof title.source.url === 'string' && /^https?:\/\//i.test(title.source.url));
  return Boolean(validId && validSource &&
    typeof title.name === 'string' &&
    ['movie', 'tv', 'anime'].includes(String(title.type)) &&
    typeof title.poster === 'string' &&
    typeof title.backdrop === 'string' &&
    typeof title.description === 'string' &&
    typeof title.releaseYear === 'number' &&
    Array.isArray(title.genres) && title.genres.every((value) => typeof value === 'string') &&
    typeof title.rating === 'number' &&
    typeof title.runtime === 'string' &&
    Array.isArray(title.cast) && title.cast.every((value) => typeof value === 'string') &&
    typeof title.director === 'string' &&
    Array.isArray(title.providers));
};

const readSelectedTitles = (): Title[] => {
  try {
    const raw = localStorage.getItem(SELECTED_TITLES_KEY);
    if (!raw) return [];
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter(isSelectedTitle).slice(-500) : [];
  } catch {
    return [];
  }
};

const mergeTitles = (current: Title[], incoming: Title[]) => {
  const byId = new Map<string, Title>();
  for (const title of [...current, ...incoming]) {
    byId.delete(title.id);
    byId.set(title.id, title);
  }

  const builtInIds = new Set(TITLES.map((title) => title.id));
  const selected = readSelectedTitles();
  const selectedIds = new Set(selected.map((title) => title.id));
  const retained = [...byId.values()].filter((title) => !builtInIds.has(title.id) && selectedIds.has(title.id));
  const recent = [...byId.values()].filter((title) =>
    !builtInIds.has(title.id) && !selectedIds.has(title.id));
  return [...TITLES, ...retained, ...recent.slice(-300)];
};

export function useCatalog() {
  const [titles, setTitles] = useState<Title[]>(() => mergeTitles(TITLES, readSelectedTitles()));
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    let active = true;
    loadLiveCatalog()
      .then((next) => {
        if (active) setTitles((current) => mergeTitles(current, next));
      })
      .catch(() => {
        if (active) setError('The catalogue source is unavailable. Showing the built-in shelf.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const retain = useCallback((title: Title) => {
    if (!title.source || !(title.id.startsWith('tvmaze-') || title.id.startsWith('wikidata-'))) return;
    try {
      const selected = readSelectedTitles();
      const byId = new Map(selected.map((item) => [item.id, item]));
      byId.set(title.id, title);
      localStorage.setItem(SELECTED_TITLES_KEY, JSON.stringify([...byId.values()].slice(-500)));
    } catch {
      // Browser storage is optional; search still works for the current session.
    }
    setTitles((current) => mergeTitles(current, [title]));
  }, []);

  const cancelSearch = useCallback(() => {
    requestId.current += 1;
    setSearching(false);
  }, []);

  const search = useCallback(async (query: string, type: 'all' | TitleType = 'all') => {
    const normalized = query.trim();
    if (normalized.length < 2) return [];
    const currentRequest = ++requestId.current;
    setSearching(true);
    setError(null);
    try {
      const results = await searchExternalCatalogue(normalized, type);
      if (currentRequest !== requestId.current) return [];
      setTitles((current) => mergeTitles(current, results));
      return results;
    } catch (cause) {
      if (currentRequest === requestId.current) {
        const message = cause instanceof Error && cause.name === 'AbortError'
          ? 'Catalogue search timed out. Please try again.'
          : cause instanceof Error
            ? cause.message
            : 'Catalogue search is temporarily unavailable.';
        setError(message);
      }
      return [];
    } finally {
      if (currentRequest === requestId.current) setSearching(false);
    }
  }, []);

  return { titles, loading, error, searching, search, cancelSearch, retain };
}
