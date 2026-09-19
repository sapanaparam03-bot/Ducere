import { useCallback, useEffect, useMemo, useState } from 'react';
import { INITIAL_PROFILE, INITIAL_USER_TITLES, type Profile, type UserStatus, type UserTitle } from '@/lib/ducere';
import { supabase } from '@/lib/supabase';

const USER_KEY = 'ducere-user-titles-v2';
const PROFILE_KEY = 'ducere-profile-v2';

const read = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};

const toDb = (uid: string, item: UserTitle) => ({
  user_id: uid,
  title_id: item.titleId,
  status: item.status,
  date_added: item.dateAdded,
  date_watched: item.dateWatched ?? null,
  rating: item.rating ?? null,
  review: item.review ?? null,
  current_season: item.currentSeason ?? null,
  current_episode: item.currentEpisode ?? null,
  progress: item.progress ?? 0,
});

const fromDb = (row: any): UserTitle => ({
  titleId: row.title_id,
  status: row.status,
  dateAdded: row.date_added,
  dateWatched: row.date_watched ?? undefined,
  rating: row.rating ?? undefined,
  review: row.review ?? undefined,
  currentSeason: row.current_season ?? undefined,
  currentEpisode: row.current_episode ?? undefined,
  progress: Number(row.progress ?? 0),
});

export function useDucere() {
  const [userTitles, setUserTitles] = useState<UserTitle[]>(() => read(USER_KEY, INITIAL_USER_TITLES));
  const [profile, setProfile] = useState<Profile>(() => read(PROFILE_KEY, INITIAL_PROFILE));
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const loadSessionData = useCallback(async (uid: string | null) => {
    setUserId(uid);
    if (!uid || !supabase) {
      setUserTitles([]);
      setProfile(INITIAL_PROFILE);
      setReady(true);
      return;
    }

    setReady(false);
    const [titlesResult, profileResult] = await Promise.all([
      supabase.from('user_titles').select('*').eq('user_id', uid),
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
    ]);

    setUserTitles(!titlesResult.error ? (titlesResult.data ?? []).map(fromDb) : []);
    setProfile(
      !profileResult.error && profileResult.data
        ? { username: profileResult.data.username, country: profileResult.data.country, appearance: profileResult.data.appearance }
        : INITIAL_PROFILE,
    );
    setReady(true);
  }, []);

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }

    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) void loadSessionData(data.session?.user.id ?? null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) void loadSessionData(session?.user.id ?? null);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [loadSessionData]);

  useEffect(() => {
    if (userId) localStorage.setItem(`${USER_KEY}:${userId}`, JSON.stringify(userTitles));
  }, [userId, userTitles]);

  useEffect(() => {
    if (userId) localStorage.setItem(`${PROFILE_KEY}:${userId}`, JSON.stringify(profile));
  }, [userId, profile]);

  const persist = useCallback(async (item: UserTitle) => {
    if (userId && supabase) {
      await supabase.from('user_titles').upsert(toDb(userId, item), { onConflict: 'user_id,title_id' });
    }
  }, [userId]);

  const getUserTitle = useCallback((id: string) => userTitles.find((item) => item.titleId === id), [userTitles]);

  const upsert = useCallback((titleId: string, patch: Partial<UserTitle> & { status?: UserStatus }) => {
    setUserTitles((current) => {
      const found = current.find((item) => item.titleId === titleId);
      const next: UserTitle = found
        ? { ...found, ...patch }
        : { titleId, status: patch.status ?? 'watchlist', dateAdded: new Date().toISOString().slice(0, 10), ...patch } as UserTitle;
      void persist(next);
      return found ? current.map((item) => item.titleId === titleId ? next : item) : [...current, next];
    });
  }, [persist]);

  const remove = useCallback((titleId: string) => {
    setUserTitles((current) => current.filter((item) => item.titleId !== titleId));
    if (userId && supabase) void supabase.from('user_titles').delete().eq('user_id', userId).eq('title_id', titleId);
  }, [userId]);

  const setStatus = useCallback((titleId: string, status: UserStatus) => {
    upsert(titleId, {
      status,
      ...(status === 'watched' ? { dateWatched: new Date().toISOString().slice(0, 10), progress: 100 } : {}),
    });
  }, [upsert]);

  const setProgress = useCallback((titleId: string, progress: number) => {
    const safeProgress = Math.max(0, Math.min(100, Math.round(progress)));
    upsert(titleId, { progress: safeProgress, ...(safeProgress >= 100 ? { status: 'watched', dateWatched: new Date().toISOString().slice(0, 10) } : { status: 'watching' }) });
  }, [upsert]);

  const updateProfile = useCallback((patch: Partial<Profile>) => {
    setProfile((current) => {
      const next = { ...current, ...patch };
      if (userId && supabase) {
        void supabase.from('profiles').upsert({
          id: userId,
          username: next.username,
          country: next.country,
          appearance: next.appearance,
          updated_at: new Date().toISOString(),
        });
      }
      return next;
    });
  }, [userId]);

  const resetData = useCallback(async () => {
    if (userId && supabase) {
      await supabase.from('user_titles').delete().eq('user_id', userId);
    }
    setUserTitles([]);
    setProfile(INITIAL_PROFILE);
  }, [userId]);

  const counts = useMemo(() => ({
    all: userTitles.length,
    watchlist: userTitles.filter((item) => item.status === 'watchlist').length,
    watching: userTitles.filter((item) => item.status === 'watching').length,
    watched: userTitles.filter((item) => item.status === 'watched').length,
  }), [userTitles]);

  return { userTitles, profile, ready, userId, getUserTitle, upsert, remove, setStatus, setProgress, updateProfile, resetData, counts };
}
