import type { Title, UserTitle } from './ducere';

export type RecommendationReason = {
  title: Title;
  score: number;
  reasons: string[];
};

export type Achievement = {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export function getGenreProfile(userTitles: UserTitle[], catalog: Title[]) {
  const counts = new Map<string, number>();
  userTitles.filter((item) => item.status !== 'watchlist').forEach((item) => {
    const title = catalog.find((candidate) => candidate.id === item.titleId);
    title?.genres.forEach((genre) => counts.set(genre, (counts.get(genre) ?? 0) + 1));
  });
  return counts;
}

export function rankRecommendations(userTitles: UserTitle[], catalog: Title[]): RecommendationReason[] {
  const genreProfile = getGenreProfile(userTitles, catalog);
  const maxGenre = Math.max(1, ...genreProfile.values());
  const preferredTypes = new Map<Title['type'], number>();
  userTitles.filter((item) => item.status !== 'watchlist').forEach((item) => {
    const title = catalog.find((candidate) => candidate.id === item.titleId);
    if (title) preferredTypes.set(title.type, (preferredTypes.get(title.type) ?? 0) + 1);
  });

  return catalog
    .filter((title) => !userTitles.some((item) => item.titleId === title.id))
    .map((title) => {
      const genreScore = title.genres.reduce((sum, genre) => sum + ((genreProfile.get(genre) ?? 0) / maxGenre) * 6, 0);
      const typeScore = (preferredTypes.get(title.type) ?? 0) > 0 ? 2 : 0;
      const ratingScore = clamp(title.rating, 0, 10) * 0.6;
      const recencyScore = title.releaseYear >= new Date().getFullYear() - 3 ? 1.5 : 0;
      const reasons = [
        ...title.genres.filter((genre) => genreProfile.has(genre)).slice(0, 2).map((genre) => `Because you watch ${genre}`),
        ...(typeScore ? [`Matches your ${title.type === 'tv' ? 'series' : title.type} habits`] : []),
        ...(recencyScore ? ['Recently released'] : []),
      ];
      return { title, score: genreScore + typeScore + ratingScore + recencyScore, reasons: reasons.slice(0, 2) };
    })
    .sort((a, b) => b.score - a.score || b.title.rating - a.title.rating);
}

export function calculateViewingMinutes(userTitles: UserTitle[], catalog: Title[]) {
  return userTitles.reduce((total, item) => {
    const title = catalog.find((candidate) => candidate.id === item.titleId);
    if (!title) return total;
    const progress = clamp(item.progress ?? (item.status === 'watched' ? 100 : 0)) / 100;
    if (title.type === 'movie') {
      const match = title.runtime.match(/(?:(\d+)h)?\s*(?:(\d+)m)?/);
      return total + ((Number(match?.[1] ?? 0) * 60) + Number(match?.[2] ?? 0)) * progress;
    }
    const episodes = item.status === 'watched' ? (title.episodes ?? 0) : (item.currentEpisode ?? 0);
    return total + episodes * (title.type === 'anime' ? 24 : 45);
  }, 0);
}

export function getAchievements(userTitles: UserTitle[], catalog: Title[]): Achievement[] {
  const watched = userTitles.filter((item) => item.status === 'watched');
  const watching = userTitles.filter((item) => item.status === 'watching');
  const rated = userTitles.filter((item) => item.rating);
  const types = new Set(watched.map((item) => catalog.find((title) => title.id === item.titleId)?.type).filter(Boolean));
  const uniqueGenres = new Set(watched.flatMap((item) => catalog.find((title) => title.id === item.titleId)?.genres ?? []));

  return [
    { id: 'first-watch', title: 'First screening', description: 'Complete your first title.', unlocked: watched.length >= 1 },
    { id: 'five-watched', title: 'Five to remember', description: 'Complete five titles.', unlocked: watched.length >= 5 },
    { id: 'genre-explorer', title: 'Genre explorer', description: 'Watch titles across five genres.', unlocked: uniqueGenres.size >= 5 },
    { id: 'three-formats', title: 'Three formats', description: 'Watch a movie, series, and anime.', unlocked: types.size >= 3 },
    { id: 'critic', title: 'Personal critic', description: 'Rate five titles.', unlocked: rated.length >= 5 },
    { id: 'storyteller', title: 'Storyteller', description: 'Keep three titles in progress.', unlocked: watching.length >= 3 },
    { id: 'twenty-watched', title: 'Twenty screenings', description: 'Complete twenty titles.', unlocked: watched.length >= 20 },
    { id: 'archive-builder', title: 'Archive builder', description: 'Collect ten titles in Ducere.', unlocked: userTitles.length >= 10 },
  ];
}
