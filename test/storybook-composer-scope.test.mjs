import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const root = path.resolve(import.meta.dirname, '..');
await mkdir(path.join(root, '.nimi/local'), { recursive: true });
const out = await mkdtemp(path.join(root, '.nimi/local/composer-scope-'));
const outfile = path.join(out, 'composer.mjs');
// Unit test of multi-step dispatch ownership. The canned chapter is test input,
// not evidence of model execution or product acceptance.
await build({ stdin: { contents: `export * from './src/storybook/ai/storybook-composer.ts';
export * from './src/storybook/content/library.ts';`, resolveDir: root, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
  plugins: [{ name: 'controlled-runtime-boundary', setup(b) {
    b.onResolve({ filter: /(?:runtime-platform|storybook-runtime-invokers)\.js$/ }, a => ({ path: a.path, namespace: 'boundary' }));
    b.onLoad({ filter: /.*/, namespace: 'boundary' }, a => ({ contents: a.path.includes('runtime-platform')
      ? 'export async function getRuntimePlatformProjection() { return globalThis.composerScopeTest.project(); }'
      : 'export async function invokeStorybookText(client) { return globalThis.composerScopeTest.invoke(client); }', loader: 'js' }));
  } }] });
const api = await import(pathToFileURL(outfile).href);
test.after(() => { delete globalThis.composerScopeTest; return rm(out, { recursive: true, force: true }); });
test('chapter writing and continuity review retain the same captured client after a session change', async () => {
  const old = { name: 'first account' }, next = { name: 'second account' }; let current = old;
  let reads = 0; const calls = [];
  const story = api.CURATED_STORIES[1];
  const chapter = { title: story.title, startNodeId: 'n1', variables: [{ id: 'connection', label: '联结', initial: 0 }], nodes: story.nodes, endings: story.endings };
  globalThis.composerScopeTest = {
    project() { reads++; return { status: 'ready', client: current }; },
    invoke(client) { calls.push(client); return { ok: true, text: JSON.stringify(chapter) }; },
  };
  const result = await api.runStoryChapter({ projectId: 'test-project', bible: { approved: true }, adaptationBrief: { approval: 'approved' }, chapters: [] }, 'source', phase => { if (phase === 'continuity') current = next; });
  assert.equal(result.ok, true);
  assert.equal(reads, 1);
  assert.deepEqual(calls, [old, old]);
});
