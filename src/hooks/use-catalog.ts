import { useEffect, useState } from 'react';
import { TITLES, type Title } from '@/lib/ducere';
import { loadLiveCatalog } from '@/lib/live-catalog';

export function useCatalog() {
  const [titles, setTitles] = useState<Title[]>(TITLES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadLiveCatalog()
      .then((next) => {
        if (active) setTitles(next);
      })
      .catch(() => {
        if (active) setError('Live catalog sources are unavailable. Showing the curated shelf.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { titles, loading, error };
}