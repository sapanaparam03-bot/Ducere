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
