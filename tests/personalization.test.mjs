import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/personalization.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const lib = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const title = (id, extra = {}) => ({ id, name: id, type: 'movie', genres: [], rating: 7, releaseYear: 2020, runtime: '90m', ...extra });
const item = (titleId, extra = {}) => ({ titleId, status: 'watched', progress: 100, dateAdded: '2026-01-01', ...extra });

test('genre profile ignores watchlist-only and unknown titles', () => {
  const profile = lib.getGenreProfile([
    item('a'), item('b', { status: 'watchlist' }), item('missing')
  ], [title('a', { genres: ['Drama', 'Mystery'] }), title('b', { genres: ['Comedy'] })]);
  assert.equal(profile.get('Drama'), 1);
  assert.equal(profile.has('Comedy'), false);
});

test('recommendations exclude saved titles and explain matching genres', () => {
  const catalog = [
    title('saved', { genres: ['Drama'] }),
    title('suggestion', { genres: ['Drama', 'Mystery'], rating: 8 }),
    title('unrelated', { genres: ['Sport'], rating: 6, releaseYear: 2010 })
  ];
  const results = lib.rankRecommendations([item('saved')], catalog);
  assert.equal(results.some(x => x.title.id === 'saved'), false);
  assert.equal(results[0].title.id, 'suggestion');
  assert.ok(results[0].reasons.some(x => x.includes('Drama')));
});

test('viewing-time calculation handles movie runtime and completed episodes', () => {
  const catalog = [
    title('movie', { runtime: '1h 35m' }),
    title('series', { type: 'tv', episodes: 12 }),
    title('anime', { type: 'anime', episodes: 24 })
  ];
  assert.equal(lib.calculateViewingMinutes([
    item('movie'), item('series'), item('anime')
  ], catalog), 95 + 12 * 45 + 24 * 24);
});

test('achievements respect thresholds and media types', () => {
  const catalog = [
    title('movie', { genres: ['Drama'] }),
    title('series', { type: 'tv', genres: ['Mystery'] }),
    title('anime', { type: 'anime', genres: ['Comedy', 'Fantasy', 'Action'] })
  ];
  const achievements = lib.getAchievements([
    item('movie', { rating: 4 }), item('series', { rating: 5 }), item('anime', { rating: 3 })
  ], catalog);
  assert.equal(achievements.find(x => x.id === 'first-watch').unlocked, true);
  assert.equal(achievements.find(x => x.id === 'three-formats').unlocked, true);
  assert.equal(achievements.find(x => x.id === 'genre-explorer').unlocked, true);
  assert.equal(achievements.find(x => x.id === 'five-watched').unlocked, false);
});
