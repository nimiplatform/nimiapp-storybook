import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { createFileBackend } from './fixtures/native-file-backend.mjs';

const root = path.resolve(import.meta.dirname, '..');
await mkdir(path.join(root, '.nimi/local'), { recursive: true });
const out = await mkdtemp(path.join(root, '.nimi/local/experience-tests-'));
const outfile = path.join(out, 'experience.mjs');
// These tests use actual files and production orchestration. The Runtime boundary
// is explicitly unavailable; they never simulate a successful model response.
await build({ stdin: { contents: `export * from './src/storybook/ai/storybook-experience.ts';
export * from './src/storybook/engine/protocol/session.ts';
export * from './src/storybook/engine/protocol/validate.ts';
export * from './src/storybook/engine/intake.ts';
export * from './src/storybook/engine/truth.ts';
export * from './src/storybook/engine/memory.ts';
export * from './src/storybook/store/storybook-store.ts';
export * from './src/storybook/store/content-editors.ts';
export * from './src/storybook/store/intake-submission.ts';
export * from './src/storybook/ai/storybook-project.ts';
export * from './src/storybook/store/protocol-store.ts';
export * from './src/storybook/store/native-repository.ts';`, resolveDir: root, loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile, logLevel: 'silent',
  plugins: [{ name: 'unavailable-runtime', setup(builder) {
    builder.onResolve({ filter: /(?:runtime-platform|storybook-runtime-invokers)\.js$/ }, args => ({ path: args.path, namespace: 'unavailable-runtime' }));
    builder.onLoad({ filter: /.*/, namespace: 'unavailable-runtime' }, args => ({ contents: args.path.includes('runtime-platform')
      ? 'export async function getRuntimePlatformProjection() { return globalThis.storybookTestRuntime ? globalThis.storybookTestRuntime() : { status: "unavailable" }; }'
      : 'export async function invokeStorybookText() { throw new Error("Unexpected model call in unavailable test"); }', loader: 'js' }));
  } }],
});

const api = await import(pathToFileURL(outfile).href);
const directory = path.join(out, 'records');
const files = createFileBackend(directory);
let beforeWrite = async () => {};
await api.initializeStorybookStore({ ...files, async write(relative, value) { await beforeWrite(relative, value); await files.write(relative, value); } });
test.after(() => rm(out, { recursive: true, force: true }));
const fresh = () => api.createExperience({ work: { format: 'nimi.storybook', version: '0.1.0', title: 'Lifecycle regression' }, sourceRef: 'test:work', cards: {}, playerName: 'Tester', now: new Date().toISOString() });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };


test('pending choice is owned by run id across reopened consumers and cannot be overwritten by generation', async () => {
  const work = { format: 'nimi.storybook', version: '0.1.0', title: 'Choice owner', modules: { 'nimi.storybook.flow': { version: '1', config: { entry: 'start', state: { route: 'start' }, nodes: [
    { id: 'start', content: [{ type: 'text', text: 'Start' }], choices: [{ id: 'go', label: 'Keep this choice', target: 'next', set: { route: 'next' } }] }, { id: 'next', content: [{ type: 'text', text: 'Next' }] },
  ] } } } };
  const run = api.createExperience({ work, sourceRef: 'test:choice', cards: {}, playerName: 'Tester', now: new Date().toISOString() });
  await api.saveExperienceRun(run);
  const started = deferred(); const release = deferred();
  beforeWrite = async (_path, value) => { if (value.id === run.id && value.nodeId === 'next' && !value.attempts.length) { started.resolve(); await release.promise; } };
  const choice = api.updateExperience(run.id, current => api.chooseExperience(current, 'go', new Date().toISOString()));
  await started.promise;
  assert.equal(api.getExperienceRun(run.id).nodeId, 'start');
  assert.equal(api.experienceBusy(run.id), true);
  await assert.rejects(api.runExperienceGeneration(run.id, { message: 'Cannot overtake the choice' }), /尚未完成/);
  release.resolve(); await choice; beforeWrite = async () => {};
  await api.runExperienceGeneration(run.id, { message: 'A later message' });
  const saved = await files.read(api.recordPath('experience-runs', run.id));
  assert.equal(saved.nodeId, 'next'); assert.equal(saved.state.route, 'next');
  assert.ok(saved.events.some(e => e.kind === 'choice' && api.eventText(e) === 'Keep this choice'));
  assert.equal(saved.checkpoints[0].label, 'Keep this choice');
});

test('project generation survives view subscription changes and merges an unavailable completion with later saved edits', async () => {
  const id = 'project-reopen-owner'; const now = new Date().toISOString();
  const project = { id, name: 'Owner test', mode: 'document-backed', truthPackageId: 'truth-owner', createdAt: now, updatedAt: now };
  const source = 'A keeper waits at a greenhouse with a letter and a lantern.';
  const converted = api.convertIntake({ kind: 'document-text', projectId: id, text: source }, now);
  assert.equal(converted.ok, true);
  const proposal = { title: 'An authored test proposal', premise: 'Original premise', world: 'Greenhouse', playerRole: 'Keeper', tension: 'Wait or leave', style: 'Quiet', themes: [], cast: [{ name: 'Guide', voice: 'Soft', publicFacts: [], privateFacts: [], goals: [] }], endingDirection: 'A choice' };
  await api.saveProject({ project, truthPackage: api.seedTruthPackage(project, converted.value, now), memory: api.createProjectMemory(id), sourceDraft: { text: source, direction: '忠于原文' }, foundationDraft: { draft: proposal, generationId: 'authored-fixture' }, generationRuns: [] });
  const started = deferred(); const release = deferred(); let calls = 0;
  globalThis.storybookTestRuntime = async () => { calls++; started.resolve(); await release.promise; return { status: 'unavailable' }; };
  const oldView = api.projectEditor(id); const unsubscribe = oldView.subscribe(() => {});
  const job = api.generateProjectFoundation(id); await started.promise; unsubscribe();
  const reopened = api.projectEditor(id);
  assert.equal(reopened, oldView); assert.equal(reopened.getSnapshot().operation.kind, 'foundation');
  await reopened.update(current => ({ ...current, revisionNote: 'New note', foundationDraft: { ...current.foundationDraft, draft: { ...current.foundationDraft.draft, premise: 'New committed premise' } } }));
  await assert.rejects(api.generateProjectFoundation(id), /操作未完成/);
  release.resolve(); await job; delete globalThis.storybookTestRuntime;
  const saved = await files.read(api.recordPath('projects', id));
  assert.equal(calls, 1); assert.equal(saved.foundationDraft.draft.premise, 'New committed premise');
  assert.equal(saved.revisionNote, 'New note'); assert.equal(saved.generationRuns.length, 1);
  assert.equal(reopened.getSnapshot().status, 'saved'); assert.equal(reopened.getSnapshot().operation, undefined);
});

test('intake submission cannot duplicate a pending handoff or delete a newer draft revision', async () => {
  const editor = api.intakeEditor(); const source = 'A submitted story that must keep its exact original source text.';
  await editor.update(() => ({ name: 'Handoff test', text: source, direction: '忠于原文' }));
  const started = deferred(); const release = deferred();
  beforeWrite = async (relative, value) => { if (relative.includes('/projects/') && value.project.name === 'Handoff test') { started.resolve(); await release.promise; } };
  const submit = api.submitIntake(); await started.promise;
  assert.equal(api.intakeEditor().getSnapshot().operation.blockNavigation, true);
  await assert.rejects(api.submitIntake(), /操作未完成/);
  const later = editor.update(current => ({ ...current, text: source + ' This newer revision must survive.' }));
  release.resolve(); const id = await submit; await later; beforeWrite = async () => {};
  assert.equal(api.getProject(id).sourceDraft.text, source);
  assert.equal(api.getIntakeDraft().text, source + ' This newer revision must survive.');
});

test('intake failed autosave retains its buffer across subscriptions and blocks navigation until real file recovery', async () => {
  const editor = api.intakeEditor(); const old = api.getIntakeDraft().text;
  const blocker = path.join(directory, api.recordPath('drafts', 'intake')) + '.tmp';
  await mkdir(blocker);
  await assert.rejects(editor.update(current => ({ ...current, text: 'Retain this pending source after a native write error.' })), /EISDIR/);
  const reopened = api.intakeEditor();
  assert.equal(reopened.getSnapshot().value.text, 'Retain this pending source after a native write error.');
  assert.equal(api.getIntakeDraft().text, old);
  await assert.rejects(reopened.flushForNavigation(), /EISDIR/);
  await rm(blocker, { recursive: true }); await reopened.flushForNavigation();
  assert.equal(api.getIntakeDraft().text, reopened.getSnapshot().value.text);
});

test('unsent dialogue is durable by run id and clears only after that message is committed', async () => {
  const run = fresh(); await api.saveExperienceRun(run);
  const editor = api.dialogueEditor(run.id); await editor.update(() => 'Keep my composed message');
  assert.equal(api.dialogueEditor(run.id).getSnapshot().value, 'Keep my composed message');
  assert.equal((await files.read(api.recordPath('drafts', `dialogue:${run.id}`))).text, 'Keep my composed message');
  await api.runExperienceGeneration(run.id, { message: editor.getSnapshot().value });
  assert.equal(editor.getSnapshot().value, '');
  assert.ok(api.getExperienceRun(run.id).events.some(e => api.eventText(e) === 'Keep my composed message'));
});

test('a media fallback behind a text output is rejected before the downstream Runtime boundary', async () => {
  const text = { type: 'text', text: 'A text request' };
  const work = { format: 'nimi.storybook', version: '0.1.0', title: 'Typed fallback', modules: { 'nimi.storybook.generation': { version: '1', config: { tasks: [
    { id: 'a', label: 'A', capability: 'text.generate', inputs: [text], outputs: [{ id: 'text', kind: 'text' }], trigger: { event: 'manual' }, reuse: 'run', fallback: [{ type: 'media', uri: 'https://example.org/image.png', mimeType: 'image/png', alt: 'Not an authorized image-to-text conversion' }] },
    { id: 'b', label: 'B', capability: 'text.generate', inputs: [text, { type: 'output', task: 'a', output: 'text' }], outputs: [{ id: 'text', kind: 'text' }], trigger: { event: 'manual' }, reuse: 'run', dependsOn: ['a'] },
  ] } } } };
  const run = api.createExperience({ work, sourceRef: 'test:media-input', cards: {}, playerName: 'Tester', now: new Date().toISOString() }); await api.saveExperienceRun(run);
  await api.runExperienceGeneration(run.id, { taskId: 'a' });
  let calls = 0; globalThis.storybookTestRuntime = async () => { calls++; return { status: 'unavailable' }; };
  const result = await api.runExperienceGeneration(run.id, { taskId: 'b' }); delete globalThis.storybookTestRuntime;
  assert.equal(calls, 0); assert.equal(result.attempts.at(-1).reason, 'capability-unavailable');
  assert.match(result.attempts.at(-1).message, /解析后的媒体/);
});
test('a different message is explicitly rejected during initial commit instead of sharing another request outcome', async () => {
  const run = fresh(); await api.saveExperienceRun(run);
  const started = deferred(); const release = deferred();
  beforeWrite = async (_relative, value) => { if (value.id === run.id && value.attempts.at(-1)?.status === 'running') { started.resolve(); await release.promise; } };
  const first = api.runExperienceGeneration(run.id, { message: 'First input' });
  await started.promise;
  assert.equal(api.experienceBusy(run.id), true);
  await assert.rejects(api.runExperienceGeneration(run.id, { message: 'Second input' }), /这次输入尚未发送/);
  release.resolve(); await first; beforeWrite = async () => {};
  assert.equal(api.getExperienceRun(run.id).events.filter(e => e.kind === 'user').length, 1);
  await api.runExperienceGeneration(run.id, { message: 'Second input' });
  const saved = await files.read(api.recordPath('experience-runs', run.id));
  assert.deepEqual(saved.events.filter(e => e.kind === 'user').map(api.eventText), ['First input', 'Second input']);
});

test('a terminal file failure is recoverable without another generation attempt or losing its actual terminal reason', async () => {
  const run = fresh(); await api.saveExperienceRun(run);
  let blocker;
  beforeWrite = async (relative, value) => {
    if (value.id === run.id && value.attempts.at(-1)?.status === 'unavailable' && !blocker) {
      blocker = path.join(directory, relative) + '.tmp'; await mkdir(blocker);
    }
  };
  await assert.rejects(api.runExperienceGeneration(run.id, { message: 'Keep this input' }), /重试保存/);
  assert.equal(api.experienceBusy(run.id), false);
  assert.equal(api.hasUncommittedExperience(), true);
  assert.equal(api.getExperienceRun(run.id).attempts.at(-1).status, 'running');
  await rm(blocker, { recursive: true }); beforeWrite = async () => {};
  const recovered = await api.recoverExperience(api.getExperienceRun(run.id));
  assert.equal(api.hasUncommittedExperience(), false);
  assert.equal(recovered.attempts.length, 1);
  assert.equal(recovered.attempts[0].reason, 'runtime-not-ready');
  assert.equal(recovered.attempts[0].status, 'unavailable');
  assert.equal(recovered.events.filter(e => e.kind === 'user').length, 1);
  assert.deepEqual(await files.read(api.recordPath('experience-runs', run.id)), JSON.parse(JSON.stringify(recovered)));
});
