import { useCallback, useEffect, useState } from 'react';
import { TITLES, type Title, type TitleType } from '@/lib/ducere';
import { loadLiveCatalog } from '@/lib/live-catalog';
import { searchExternalCatalogue } from '@/lib/catalogue-search';

const mergeTitles = (current: Title[], incoming: Title[]) => {
  const seen = new Set(current.map((title) => title.id));
  return [...current, ...incoming.filter((title) => !seen.has(title.id))];
};

export function useCatalog() {
  const [titles, setTitles] = useState<Title[]>(TITLES);
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

  return { titles, loading, error, searching, search };
}
