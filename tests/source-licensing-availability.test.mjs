import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('new catalogue search uses Wikidata only and does not call retired catalogue APIs', async () => {
  const source = await read('../src/lib/catalogue-search.ts');
  assert.match(source, /wikidata\.org\/w\/api\.php/);
  assert.match(source, /license: 'CC0'/);
  assert.doesNotMatch(source, /api\.tvmaze\.com|themoviedb|omdbapi|api\.watchmode\.com/i);
});

test('availability UI never marks an unreviewed provider as verified', async () => {
  const source = await read('../src/components/availability-panel.tsx');
  const service = await read('../src/lib/availability.ts');
  assert.match(source, /Community-powered/);
  assert.match(service, /community_catalogue_unavailable/);
  assert.match(service, /sources: \[\]/);
  assert.doesNotMatch(source + service, /watchmode|verified source/i);
});

test('community availability schema defaults reports to pending and exposes only current verified claims', async () => {
  const sql = await read('../supabase-community-availability.sql');
  assert.match(sql, /status text not null default 'pending'/);
  assert.match(sql, /status = 'verified' and expires_at > now\(\)/);
  assert.match(sql, /reporter_id = auth\.uid\(\)/);
  assert.match(sql, /not exists \([\s\S]*reporter_id = auth\.uid\(\)/);
  assert.doesNotMatch(sql, /http:\/\//i);
});
