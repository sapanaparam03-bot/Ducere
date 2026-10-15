import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/title-metadata.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const metadata = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

test('exact metadata matching tolerates punctuation, case, and accents', () => {
  const candidates = [
    { name: 'Amélie: Part II', id: 1 },
    { name: 'Amelie', id: 2 },
  ];
  assert.equal(metadata.findExactNameMatch(candidates, (item) => item.name, 'Amelie: Part II!')?.id, 1);
  assert.equal(metadata.findExactNameMatch(candidates, (item) => item.name, 'AMÉLIE')?.id, 2);
});

test('exact metadata matching never substitutes a different adaptation', () => {
  const candidates = [
    { name: 'The Office (US)', id: 1 },
    { name: 'The Office (UK)', id: 2 },
  ];
  assert.equal(metadata.findExactNameMatch(candidates, (item) => item.name, 'The Office') , undefined);
  assert.equal(metadata.findExactNameMatch(candidates, (item) => item.name, 'The Office (UK)')?.id, 2);
});

test('exact metadata matching safely handles empty names and no results', () => {
  assert.equal(metadata.findExactNameMatch([], (item) => item.name, 'Missing'), undefined);
  assert.equal(metadata.findExactNameMatch([{ name: 'Example' }], (item) => item.name, '   '), undefined);
});

test('exact metadata matching uses release year to disambiguate same-name adaptations', () => {
  const candidates = [
    { name: 'The Office', premiered: '2001-07-09', id: 'uk' },
    { name: 'The Office', premiered: '2005-03-24', id: 'us' },
  ];
  const yearOf = (item) => Number(item.premiered.slice(0, 4));
  assert.equal(metadata.findExactNameMatch(candidates, (item) => item.name, 'The Office', 2005, yearOf)?.id, 'us');
  assert.equal(metadata.findExactNameMatch(candidates, (item) => item.name, 'The Office', 2010, yearOf), undefined);
});
