import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/archive-transfer.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const transfer = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

const catalog = [
  { id: 'lion-1994', name: 'The Lion King', type: 'movie', releaseYear: 1994, genres: [], rating: 8, runtime: '88m' },
  { id: 'lion-2019', name: 'The Lion King', type: 'movie', releaseYear: 2019, genres: [], rating: 7, runtime: '118m' },
  { id: 'show-1', name: 'Example Show', type: 'tv', releaseYear: 2020, genres: [], rating: 7, runtime: '', episodes: 10 },
];

test('CSV import respects a supplied release year and avoids the wrong adaptation', () => {
  const result = transfer.importCsvText('Title,Year,Status\nThe Lion King,2019,Completed', catalog);
  assert.equal(result.rows, 1);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].titleId, 'lion-2019');
  const mismatch = transfer.importCsvText('Title,Year,Status\nThe Lion King,1980,Completed', catalog);
  assert.equal(mismatch.items.length, 0);
});

test('CSV import parses quoted commas and safely clamps progress and ratings', () => {
  const result = transfer.importCsvText('Title,Status,Progress,Your Rating\n"Example Show, Special",Watching,150,10\nExample Show,Watching,150,10', catalog);
  assert.equal(result.rows, 2);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].progress, 100);
  assert.equal(result.items[0].rating, 5);
});

test('backup parser rejects invalid JSON, wrong formats, and oversized input', () => {
  assert.throws(() => transfer.parseDucereBackup('{'), /valid JSON/);
  assert.throws(() => transfer.parseDucereBackup(JSON.stringify({ format: 'other', version: 1, profile: {}, titles: [] })), /valid Ducere backup/);
  assert.throws(() => transfer.parseDucereBackup(' '.repeat(10_000_001)), /too large/);
});

test('backup parser sanitizes malformed title fields and removes duplicate title IDs', () => {
  const parsed = transfer.parseDucereBackup(JSON.stringify({
    format: 'ducere-backup',
    version: 1,
    profile: { username: ' Viewer ', country: 'in', appearance: 'day', streamingServices: [' Netflix ', 3, 'Netflix'] },
    titles: [
      { titleId: 'movie-1', status: 'watched', dateAdded: '2026-01-01', rating: 4, progress: 100 },
      { titleId: 'movie-1', status: 'watchlist', dateAdded: 'bad-date', rating: 99, progress: -4 },
      { titleId: '', status: 'watched' },
      { titleId: 'movie-2', status: 'invalid' }
    ]
  }));
  assert.equal(parsed.titles.length, 1);
  assert.equal(parsed.titles[0].titleId, 'movie-1');
  assert.equal(parsed.titles[0].status, 'watchlist');
  assert.equal(parsed.titles[0].rating, undefined);
  assert.equal(parsed.titles[0].progress, 0);
  assert.equal(parsed.profile.username, 'Viewer');
  assert.deepEqual(parsed.profile.streamingServices, ['Netflix']);
});
