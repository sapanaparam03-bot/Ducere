import { useCallback, useEffect, useState } from 'react';
import { TITLES, type Title, type TitleType } from '@/lib/ducere';
import { loadLiveCatalog } from '@/lib/live-catalog';
import { searchExternalCatalogue } from '@/lib/catalogue-search';

const SELECTED_TITLES_KEY = 'ducere-selected-catalogue-v1';

const readSelectedTitles = (): Title[] => {
  try {
    const raw = localStorage.getItem(SELECTED_TITLES_KEY);
    if (!raw) return [];
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is Title => Boolean(
      item && typeof item.id === 'string' &&
      (item.id.startsWith('tvmaze-') || item.id.startsWith('wikidata-')) &&
      item.source && typeof item.source.url === 'string'
    ));
  } catch {
    return [];
  }
};

const mergeTitles = (current: Title[], incoming: Title[]) => {
  const seen = new Set(current.map((title) => title.id));
  return [...current, ...incoming.filter((title) => !seen.has(title.id))];
};

export function useCatalog() {
  const [titles, setTitles] = useState<Title[]>(() => mergeTitles(TITLES, readSelectedTitles()));
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const search = useCallback(async (query: string, type: 'all' | TitleType = 'all') => {
    const normalized = query.trim();
    if (normalized.length < 2) return [];
    setSearching(true);
    setError(null);
    try {
      const results = await searchExternalCatalogue(normalized, type);
      setTitles((current) => mergeTitles(current, results));
      return results;
    } catch (cause) {
      const message = cause instanceof Error && cause.name === 'AbortError'
        ? 'Series search timed out. Please try again.'
        : cause instanceof Error
          ? cause.message
          : 'Series search is temporarily unavailable.';
      setError(message);
      return [];
    } finally {
      setSearching(false);
    }
  }, []);

  return { titles, loading, error, searching, search, retain };
}
