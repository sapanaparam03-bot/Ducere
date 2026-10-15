import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCatalogName,
  inferMediaTypeFromDescription,
  deduplicateCatalogueTitles,
  mergeCatalogueTitles,
} from '../src/lib/catalogue-utils.js';

test('normalizes punctuation, spacing, and accents consistently', () => {
  assert.equal(normalizeCatalogName('  Amélie: Part II! '), 'amelie part ii');
  assert.equal(normalizeCatalogName('SPIDER-MAN'), 'spider man');
});

test('classifies common media descriptions without guessing unrelated items', () => {
  assert.equal(inferMediaTypeFromDescription('American television series'), 'tv');
  assert.equal(inferMediaTypeFromDescription('2024 Japanese animated film'), 'anime');
  assert.equal(inferMediaTypeFromDescription('American science fiction film'), 'movie');
  assert.equal(inferMediaTypeFromDescription('Japanese manga artist'), null);
  assert.equal(inferMediaTypeFromDescription('A popular entertainer'), null);
});

test('deduplicates same-source IDs and same title/year across sources', () => {
  const titles = [
    { id: 'tvmaze-1', name: 'The Office', type: 'tv', releaseYear: 2005 },
    { id: 'wikidata-Q1', name: ' the OFFICE ', type: 'tv', releaseYear: 2005 },
    { id: 'wikidata-Q2', name: 'The Office', type: 'tv', releaseYear: 2001 },
    { id: 'wikidata-Q3', name: 'The Office', type: 'movie', releaseYear: 2010 },
    { id: 'tvmaze-1', name: 'Duplicate ID', type: 'tv', releaseYear: 2020 },
  ];
  const result = deduplicateCatalogueTitles(titles);
  assert.deepEqual(result.map((item) => item.id), ['tvmaze-1', 'wikidata-Q2', 'wikidata-Q3']);
});

test('a missing year does not create a second ambiguous copy', () => {
  const result = deduplicateCatalogueTitles([
    { id: 'a', name: 'Arrival', type: 'movie', releaseYear: 2016 },
    { id: 'b', name: 'Arrival', type: 'movie', releaseYear: 0 },
  ]);
  assert.equal(result.length, 1);
});

test('bounded catalogue merge preserves built-ins and selected titles', () => {
  const base = [{ id: 'built-in' }];
  const selected = [{ id: 'saved-title' }];
  const current = [...base, ...selected, { id: 'recent-0' }];
  const incoming = Array.from({ length: 10_000 }, (_, index) => ({ id: `recent-${index + 1}` }));
  const result = mergeCatalogueTitles(base, selected, current, incoming, 300);
  assert.equal(result[0].id, 'built-in');
  assert.ok(result.some((item) => item.id === 'saved-title'));
  assert.equal(result.length, 302);
  assert.equal(result.at(-1).id, 'recent-10000');
  assert.equal(new Set(result.map((item) => item.id)).size, result.length);
});

test('10,000 repeated updates stay bounded and preserve newest entries', () => {
  const base = [{ id: 'base' }];
  let current = [...base];
  for (let i = 0; i < 10_000; i += 1) {
    current = mergeCatalogueTitles(base, [], current, [{ id: `item-${i}` }], 250);
  }
  assert.equal(current.length, 251);
  assert.equal(current.at(-1).id, 'item-9999');
  assert.equal(new Set(current.map((item) => item.id)).size, current.length);
});


test('a zero recent-cache limit retains only built-in and selected titles', () => {
  const result = mergeCatalogueTitles([{ id: 'base' }], [{ id: 'saved' }], [{ id: 'base' }, { id: 'saved' }, { id: 'old' }], [{ id: 'new' }], 0);
  assert.deepEqual(result.map((item) => item.id), ['base', 'saved']);
});


test('deduplicates large batches with unknown years without quadratic key scans', () => {
  const titles = Array.from({ length: 10_000 }, (_, index) => ({
    id: 'unknown-year-' + index,
    name: 'Title ' + index,
    type: 'movie',
    releaseYear: 0,
  }));
  const result = deduplicateCatalogueTitles(titles);
  assert.equal(result.length, 10_000);
  assert.equal(result.at(-1).id, 'unknown-year-9999');
});

test('unknown-year duplicates are rejected regardless of which year appears first', () => {
  assert.deepEqual(
    deduplicateCatalogueTitles([
      { id: 'unknown-first', name: 'Example', type: 'movie', releaseYear: 0 },
      { id: 'known-later', name: 'Example', type: 'movie', releaseYear: 2022 },
    ]).map((item) => item.id),
    ['unknown-first'],
  );
  assert.deepEqual(
    deduplicateCatalogueTitles([
      { id: 'known-first', name: 'Example', type: 'movie', releaseYear: 2022 },
      { id: 'unknown-later', name: 'Example', type: 'movie', releaseYear: 0 },
    ]).map((item) => item.id),
    ['known-first'],
  );
});


test('normal-use simulation: search results from multiple sources merge without duplicate titles', () => {
  const searchResults = [
    { id: 'tvmaze-82', name: 'The Bear', type: 'tv', releaseYear: 2022 },
    { id: 'wikidata-Q123', name: ' the bear ', type: 'tv', releaseYear: 2022 },
    { id: 'wikidata-Q124', name: 'The Bear', type: 'movie', releaseYear: 2010 },
    { id: 'wikidata-Q125', name: 'The Bear', type: 'tv', releaseYear: 0 },
    { id: 'tvmaze-83', name: 'Severance', type: 'tv', releaseYear: 2022 },
  ];
  const result = deduplicateCatalogueTitles(searchResults);
  assert.deepEqual(result.map((title) => title.id), ['tvmaze-82', 'wikidata-Q124', 'tvmaze-83']);
});

test('usage variation simulation: saved titles survive refreshes and recent search results stay bounded', () => {
  const builtIns = [{ id: 'built-in-1' }, { id: 'built-in-2' }];
  const saved = [{ id: 'saved-movie' }, { id: 'saved-anime' }];
  let current = [...builtIns, ...saved];
  for (let round = 0; round < 120; round += 1) {
    const incoming = Array.from({ length: 35 }, (_, index) => ({
      id: `search-${round}-${index}`,
      name: `Result ${index % 17}`,
      type: index % 3 === 0 ? 'anime' : index % 3 === 1 ? 'tv' : 'movie',
      releaseYear: 2000 + (index % 8),
    }));
    current = mergeCatalogueTitles(builtIns, saved, current, incoming, 75);
    assert.equal(current[0].id, 'built-in-1');
    assert.equal(current[1].id, 'built-in-2');
    assert.ok(current.some((title) => title.id === 'saved-movie'));
    assert.ok(current.some((title) => title.id === 'saved-anime'));
    assert.ok(current.length <= builtIns.length + saved.length + 75);
    assert.equal(new Set(current.map((title) => title.id)).size, current.length);
  }
});

test('edge-case simulation: malformed catalogue entries do not break deduplication', () => {
  const result = deduplicateCatalogueTitles([
    null,
    undefined,
    {},
    { id: 12, name: 'Wrong ID type', type: 'movie', releaseYear: 2020 },
    { id: 'valid-1', name: 'Arrival', type: 'movie', releaseYear: 2016 },
    { id: 'valid-1', name: 'Duplicate identifier', type: 'tv', releaseYear: 2021 },
    { id: 'valid-2', name: 'Arrival', type: 'movie', releaseYear: 2016 },
    { id: 'valid-3', name: 'Arrival', type: 'movie', releaseYear: 0 },
  ]);
  assert.deepEqual(result.map((title) => title.id), ['valid-1']);
});

test('stress simulation: a large incoming batch keeps memory bounded and selected titles retained', () => {
  const base = [{ id: 'home-featured' }];
  const selected = [{ id: 'my-watchlist-1' }, { id: 'my-watchlist-2' }];
  const current = [...base, ...selected];
  const incoming = Array.from({ length: 25_000 }, (_, index) => ({ id: `stress-${index}` }));
  const result = mergeCatalogueTitles(base, selected, current, incoming, 400);
  assert.equal(result.length, 403);
  assert.equal(result[0].id, 'home-featured');
  assert.ok(result.some((title) => title.id === 'my-watchlist-1'));
  assert.ok(result.some((title) => title.id === 'my-watchlist-2'));
  assert.equal(result.at(-1).id, 'stress-24999');
  assert.equal(new Set(result.map((title) => title.id)).size, result.length);
});
