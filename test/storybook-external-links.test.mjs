import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
await mkdir(path.join(root, '.nimi/local'), { recursive: true });
const directory = await mkdtemp(path.join(root, '.nimi/local/links-test-'));
const file = path.join(directory, 'links.mjs');
await build({ entryPoints: [path.join(root, 'src-electron/external-links.ts')], outfile: file, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
const { externalWebUrl } = await import(pathToFileURL(file).href);
test.after(() => rm(directory, { recursive: true, force: true }));
test('native link dispatch permits only credential-free HTTP(S) destinations', () => {
  assert.equal(externalWebUrl('https://example.org/article?q=story'), 'https://example.org/article?q=story');
  assert.equal(externalWebUrl('http://example.org'), 'http://example.org/');
  for (const url of ['javascript:alert(1)', 'file:///tmp/script', 'data:text/html,<script>', 'mailto:a@example.org', 'https://name:secret@example.org', 'not a URL']) assert.equal(externalWebUrl(url), undefined);
});
