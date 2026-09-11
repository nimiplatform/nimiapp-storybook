import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createFileBackend } from './fixtures/native-file-backend.mjs';

const root = path.resolve(import.meta.dirname, '..');
await mkdir(path.join(root, '.nimi/local'), { recursive: true });
const out = await mkdtemp(path.join(root, '.nimi/local/studio-draft-tests-'));
const outfile = path.join(out, 'studio.mjs');
await build({ stdin: { contents: `export * from './src/storybook/ui/studio/studio-home.tsx';
export * from './src/storybook/store/storybook-store.ts';`, resolveDir: root, loader: 'tsx' }, outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external', jsx: 'automatic', logLevel: 'silent' });
const api = await import(pathToFileURL(outfile).href);
await api.initializeStorybookStore(createFileBackend(path.join(out, 'records')));
test.after(() => rm(out, { recursive: true, force: true }));

test('Studio renders invalid persisted drafts and retains their original text for recovery', async () => {
  const drafts = ['{', 'null', '[]', '{"title":{"nested":"still editing"}}', '{"title":[{"nested":true}]}', '{"title":42}', '{"title":true}', '{"title":"   "}'];
  for (const [index, text] of drafts.entries()) await api.saveWorkDraft(`invalid-${index}`, text);
  await api.saveWorkDraft('named', '{"title":"A retained draft"}');
  const html = renderToStaticMarkup(createElement(api.StudioHome));
  assert.equal((html.match(/尚未命名的草稿/g) ?? []).length, drafts.length);
  assert.match(html, /A retained draft/);
  assert.match(html, /继续草稿/);
  drafts.forEach((text, index) => assert.equal(api.getWorkDraft(`invalid-${index}`).text, text));
});
