import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createFileBackend } from './fixtures/native-file-backend.mjs';

const root = path.resolve(import.meta.dirname, '..');
await mkdir(path.join(root, '.nimi/local'), { recursive: true });
const out = await mkdtemp(path.join(root, '.nimi/local/session-scope-'));
const outfile = path.join(out, 'scope.mjs');
await build({ stdin: { contents: `export * from './src/storybook/store/native-repository.ts';
export * from './src/storybook/store/editor-session.ts';`, resolveDir: root, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent' });
const api = await import(pathToFileURL(outfile).href);
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
let caseId = 0;
const files = () => createFileBackend(path.join(out, `records-${caseId++}`));
test.beforeEach(() => { api.resetStorybookStore(); api.resetStorybookEditors(); });
test.after(() => rm(out, { recursive: true, force: true }));

test('disconnect keeps verified-identity read cache, rejects writes, and allows explicit save after reconnect', async () => {
  const storage = files(); await api.initializeStorybookStore(storage);
  await api.putRecord('drafts', 'one', { text: 'saved' });
  const editor = api.sharedEditorSession('one', () => ({ text: 'saved' }), v => api.putRecord('drafts', 'one', v));
  api.detachStorybookStore();
  assert.deepEqual(api.getRecord('drafts', 'one'), { text: 'saved' });
  await assert.rejects(editor.update(() => ({ text: 'unsaved' })), /连接已变化/);
  assert.equal(editor.getSnapshot().value.text, 'unsaved');
  assert.equal(editor.getSnapshot().status, 'error');
  await api.initializeStorybookStore(storage);
  assert.equal((await storage.read(api.recordPath('drafts', 'one'))).text, 'saved');
  await editor.flush();
  assert.equal((await storage.read(api.recordPath('drafts', 'one'))).text, 'unsaved');
});

test('in-flight write stays on old storage; queued writes and old read results never populate another identity', async () => {
  const old = files(), next = files(), entered = deferred(), release = deferred();
  let writes = 0;
  await api.initializeStorybookStore({ ...old, async write(p, v) { writes++; entered.resolve(); await release.promise; await old.write(p, v); } });
  const first = api.putRecord('drafts', 'old', { private: true });
  const firstRejected = assert.rejects(first, /连接已变化/);
  await entered.promise;
  const queued = api.putRecord('drafts', 'queued', { private: true });
  const queuedRejected = assert.rejects(queued, /连接已变化/);
  api.resetStorybookStore(); await api.initializeStorybookStore(next);
  await api.putRecord('drafts', 'new', { private: false });
  release.resolve(); await firstRejected; await queuedRejected;
  assert.equal(writes, 1);
  assert.deepEqual(await next.list(api.RECORD_ROOT), [api.recordPath('drafts', 'new')]);
  assert.equal(api.getRecord('drafts', 'old'), null);
  assert.deepEqual(api.getRecord('drafts', 'new'), { private: false });
});

test('a late content-library load cannot replace the new identity library', async () => {
  const old = files(), next = files(), entered = deferred(), release = deferred();
  await old.write(api.recordPath('drafts', 'old'), { secret: true });
  const opening = api.initializeStorybookStore({ ...old, async read(p) { entered.resolve(); await release.promise; return old.read(p); } });
  const rejected = assert.rejects(opening, /旧读取结果已丢弃/);
  await entered.promise; api.resetStorybookStore(); await api.initializeStorybookStore(next);
  release.resolve(); await rejected;
  assert.deepEqual(api.allRecords('drafts'), []);
});

test('an old editor cannot save or attach to a same-named editor in the new identity', async () => {
  await api.initializeStorybookStore(files());
  const old = api.sharedEditorSession('intake', () => 'old', v => api.putRecord('drafts', 'intake', v));
  api.resetStorybookStore(); api.resetStorybookEditors();
  const next = files(); await api.initializeStorybookStore(next);
  const current = api.sharedEditorSession('intake', () => 'new', v => api.putRecord('drafts', 'intake', v));
  await current.update(() => 'new draft');
  await assert.rejects(old.update(() => 'old late draft'), /身份已变化/);
  assert.notEqual(old, current);
  assert.equal(await next.read(api.recordPath('drafts', 'intake')), 'new draft');
});

test('queued editor saves do not silently move onto a reconnected carrier', async () => {
  const old = files(), next = files(), entered = deferred(), release = deferred();
  await api.initializeStorybookStore({ ...old, async write(p, v) { entered.resolve(); await release.promise; await old.write(p, v); } });
  const editor = api.sharedEditorSession('queued', () => 'initial', v => api.putRecord('drafts', 'queued', v));
  const first = editor.update(() => 'first'); const rejectedFirst = assert.rejects(first, /连接已变化/);
  await entered.promise;
  const queued = editor.update(() => 'second'); const rejectedQueued = assert.rejects(queued, /连接已变化/);
  api.detachStorybookStore(); await api.initializeStorybookStore(next);
  release.resolve(); await rejectedFirst; await rejectedQueued;
  assert.deepEqual(await next.list(api.RECORD_ROOT), []);
  assert.equal(editor.getSnapshot().value, 'second');
  await editor.flush();
  assert.equal(await next.read(api.recordPath('drafts', 'queued')), 'second');
});
