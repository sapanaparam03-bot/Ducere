import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/availability-utils.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const utils = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

test('availability source types are mapped to the UI provider contract', () => {
  const result = utils.normalizeAvailabilityResult({
    titleId: 42,
    titleName: 'Example',
    attributionRequired: true,
    sources: [
      { name: 'Stream', type: 'sub', web_url: 'https://example.com/watch', source_id: 7 },
      { name: 'Free service', type: 'ads' },
      { name: 'Rental', type: 'rent' },
      { name: 'Purchase', type: 'buy' },
      { name: 'Unknown', type: 'unexpected' },
    ],
  }, 'in');

  assert.deepEqual(result.sources.map((source) => source.kind), ['streaming', 'free', 'rent', 'buy', 'info']);
  assert.equal(result.sources[0].url, 'https://example.com/watch');
  assert.equal(result.sources[0].sourceId, 7);
  assert.equal(result.sources[0].region, 'IN');
  assert.equal(result.sources[0].verified, true);
});

test('availability normalizer drops unsafe or malformed provider links', () => {
  const result = utils.normalizeAvailabilityResult({
    titleId: 1,
    titleName: 'Example',
    sources: [
      { name: 'Unsafe', type: 'sub', web_url: 'javascript:alert(1)' },
      { name: 'Malformed', type: 'free', web_url: 'not a url' },
      { name: 'Safe', type: 'sub', web_url: 'https://example.com' },
      { type: 'sub', web_url: 'https://missing-name.example' },
    ],
  }, 'US');

  assert.equal(result.sources.length, 3);
  assert.equal(result.sources[0].url, undefined);
  assert.equal(result.sources[1].url, undefined);
  assert.equal(result.sources[2].url, 'https://example.com/');
});

test('availability normalizer rejects invalid payloads and country codes', () => {
  assert.throws(() => utils.normalizeAvailabilityResult(null, 'US'), /invalid response/i);
  assert.throws(() => utils.normalizeAvailabilityResult({ sources: {} }, 'US'), /sources list/i);
  assert.throws(() => utils.normalizeAvailabilityResult({ sources: [] }, 'USA'), /two-letter region/i);
});

test('availability cache expires entries after its freshness window', () => {
  const cache = new Map();
  utils.writeFreshCache(cache, 'title:IN', { sources: [] }, 1000, 500);
  assert.deepEqual(utils.readFreshCache(cache, 'title:IN', 1499), { sources: [] });
  assert.equal(utils.readFreshCache(cache, 'title:IN', 1500), undefined);
  assert.equal(cache.has('title:IN'), false);
});

test('availability cache evicts oldest entries and prunes expired entries', () => {
  const cache = new Map();
  utils.writeFreshCache(cache, 'a', 1, 100, 1000, 2);
  utils.writeFreshCache(cache, 'b', 2, 100, 1000, 2);
  utils.writeFreshCache(cache, 'c', 3, 100, 1000, 2);
  assert.equal(cache.has('a'), false);
  assert.equal(utils.readFreshCache(cache, 'b', 101), 2);
  utils.writeFreshCache(cache, 'd', 4, 1200, 1000, 2);
  assert.equal(cache.has('b'), false);
  assert.equal(cache.has('c'), false);
  assert.equal(utils.readFreshCache(cache, 'd', 1201), 4);
});
