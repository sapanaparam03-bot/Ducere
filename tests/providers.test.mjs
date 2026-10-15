import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/providers.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const providers = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

test('provider matching accepts known names and aliases case-insensitively', () => {
  assert.equal(providers.providerKeyForName('Netflix'), 'netflix');
  assert.equal(providers.providerKeyForName('  AMAZON   PRIME VIDEO '), 'prime-video');
  assert.equal(providers.providerKeyForName('Hotstar'), 'jiohotstar');
  assert.equal(providers.providerKeyForName('Crunchyroll'), 'crunchyroll');
});

test('provider matching does not accept broad or partial false matches', () => {
  assert.equal(providers.providerKeyForName('Amazon'), undefined);
  assert.equal(providers.providerKeyForName('Netflix Kids'), undefined);
  assert.equal(providers.providerKeyForName('Fake Netflix'), undefined);
  assert.equal(providers.providerKeyForName(''), undefined);
});
