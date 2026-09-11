import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
mkdirSync(path.join(root, '.nimi/local'), { recursive: true });
const out = mkdtempSync(path.join(root, '.nimi/local/product-tests-'));
execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '--outDir', out, '--rootDir', '.', '--resolveJsonModule', 'true', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022', '--skipLibCheck', 'true', '--strict', 'true', '--noEmit', 'false', 'src/storybook/content/library.ts', 'src/storybook/engine/index.ts', 'src/storybook/engine/play-session.ts'], { cwd: root, stdio: 'pipe' });
const engine = await import(pathToFileURL(path.join(out, 'src/storybook/engine/index.js')).href);
const { CURATED_STORIES, buildCuratedPackage } = await import(pathToFileURL(path.join(out, 'src/storybook/content/library.js')).href);
const { advanceStory, forkStory } = await import(pathToFileURL(path.join(out, 'src/storybook/engine/play-session.js')).href);
const now = '2026-09-11T07:00:00.000Z';
test.after(() => rmSync(out, { recursive: true, force: true }));
function initial(prepared) {
  const chapter = prepared.playableChapters[0];
  const run = engine.startRun({ projectId: prepared.manifest.packageId, packageId: prepared.manifest.packageId, chapter, variables: prepared.stateMatrix.variables, flags: prepared.stateMatrix.flags, now });
  return { packageId: run.packageId, run, transcript: engine.appendTranscriptEntry(engine.createTranscript(run.id), { at: now, kind: 'enter-node', detail: '开场', nodeId: run.currentNodeId }), checkpoints: [] };
}

test('every authored library route is playable, reaches a declared ending, and references real bundled art', () => {
  for (const story of CURATED_STORIES) {
    const result = buildCuratedPackage(story, now);
    assert.equal(result.ok, true, JSON.stringify(result));
    const prepared = result.value;
    assert.equal(engine.validatePreparedPackage(prepared).valid, true);
    assert.ok(existsSync(path.join(root, 'public', story.cover)));
    const reached = new Set();
    const chapter = prepared.playableChapters[0];
    function walk(record, visited) {
      assert.ok(!visited.includes(record.run.currentNodeId), 'no endless loops');
      if (record.run.status === 'ended') { reached.add(record.run.endingId); return; }
      const node = engine.findNode(chapter, record.run.currentNodeId);
      assert.ok(node.choices.length > 0);
      for (const choice of node.choices) {
        const next = advanceStory(record, chapter, choice, now);
        assert.equal(next.checkpoints.length, record.checkpoints.length + 1);
        assert.equal(next.transcript.entries.at(-2).detail, choice.label);
        walk(next, [...visited, node.id]);
      }
    }
    walk(initial(prepared), []);
    assert.deepEqual([...reached].sort(), story.endings.map((e) => e.id).sort());
  }
});

test('replaying a choice preserves the old ending and excludes future state and conversation from the new run', () => {
  const prepared = buildCuratedPackage(CURATED_STORIES[0], now).value;
  const chapter = prepared.playableChapters[0];
  let record = initial(prepared);
  record = advanceStory(record, chapter, chapter.nodes[0].choices[1], now);
  const firstCheckpoint = record.checkpoints[0];
  record.run.achievements.push('only-after-the-choice');
  record.transcript = engine.appendTranscriptEntry(record.transcript, { at: now, kind: 'source-turn', detail: '未来对话', text: '这句话还没有发生', nodeId: record.run.currentNodeId });
  const original = structuredClone(record);
  const fork = forkStory(record, firstCheckpoint.id, now);
  assert.deepEqual(record, original, 'original experience is untouched');
  assert.notEqual(fork.run.id, record.run.id);
  assert.equal(fork.run.currentNodeId, 'n1');
  assert.deepEqual(fork.run.achievements, []);
  assert.ok(!JSON.stringify(fork.transcript).includes('这句话还没有发生'));
  assert.equal(fork.transcript.runId, fork.run.id);
  const other = advanceStory(fork, chapter, chapter.nodes[0].choices[0], now);
  assert.equal(other.run.currentNodeId, 'tower');
  assert.equal(record.run.currentNodeId, 'inn');
  assert.throws(() => forkStory(record, 'missing', now));
});

test('story replay retains generation provenance at each checkpoint and excludes later attempts', () => {
  const prepared = buildCuratedPackage(CURATED_STORIES[0], now).value;
  const chapter = prepared.playableChapters[0];
  const attempt = id => ({ id, projectId: prepared.manifest.packageId, kind: 'scene-text', request: { prompt: id }, provenance: { at: now, status: 'unavailable', reason: 'runtime-not-ready' }, outputRefs: [] });
  let record = { ...initial(prepared), generationRuns: [attempt('before-first-choice')] };
  record = advanceStory(record, chapter, chapter.nodes[0].choices[0], now);
  record.generationRuns = [...record.generationRuns, attempt('before-second-choice')];
  const node = engine.findNode(chapter, record.run.currentNodeId);
  record = advanceStory(record, chapter, node.choices[0], now);
  record.generationRuns = [...record.generationRuns, attempt('abandoned-future')];
  const original = structuredClone(record);
  const fork = forkStory(record, record.checkpoints[1].id, now);
  assert.deepEqual(fork.generationRuns.map(r => r.id), ['before-first-choice', 'before-second-choice']);
  const earlier = forkStory(fork, fork.checkpoints[0].id, now);
  assert.deepEqual(earlier.generationRuns.map(r => r.id), ['before-first-choice']);
  fork.generationRuns[0].request.prompt = 'fork-only edit';
  assert.deepEqual(record, original);
});

test('generated chapters reject broken JSON, missing paths, repeated identities, endless loops and unknown state effects', () => {
  const story = CURATED_STORIES[1];
  const valid = { title: story.title, startNodeId: 'n1', variables: [{ id: 'connection', label: '联结', initial: 0 }], nodes: story.nodes, endings: story.endings };
  assert.equal(engine.parseChapterDraft(JSON.stringify(valid)).ok, true);
  assert.equal(engine.parseChapterDraft('{').ok, false);
  for (const mutate of [
    (d) => { d.nodes[0].choices[0].targetNodeId = 'nonexistent'; },
    (d) => { d.nodes[0].choices[0].targetNodeId = 'n1'; },
    (d) => { d.nodes[0].choices[0].effects = [{ op: 'add-var', target: 'invented', value: 1 }]; },
    (d) => { d.nodes[1].id = d.nodes[0].id; },
    (d) => { d.nodes[0].text = ''; },
    (d) => { d.endings.push({ id: 'orphan', label: '无法到达' }); },
  ]) { const changed = structuredClone(valid); mutate(changed); assert.equal(engine.parseChapterDraft(JSON.stringify(changed)).ok, false); }
});

test('source adaptation admits reviewed foundation and validated chapter with provenance before Play export', () => {
  const project = { id: 'author-test', name: '故事', mode: 'document-backed', truthPackageId: 'truth-author', createdAt: now, updatedAt: now };
  const conversion = engine.convertIntake({ kind: 'document-text', projectId: project.id, text: '你来到一个深夜车站，列车能带你回到没来得及告别的那天。' }, now);
  let truth = engine.seedTruthPackage(project, conversion.value, now);
  const story = CURATED_STORIES[1];
  const foundation = { title: story.title, premise: story.subtitle, world: '夜间的记忆列车。', playerRole: story.role, tension: '告别与留下', style: '有留白的文学叙述', themes: story.themes, cast: story.cast, endingDirection: '重新理解告别的含义' };
  const admitted = engine.admitFoundation(truth, foundation, 'real-result-fixture-foundation', now);
  assert.equal(admitted.ok, true); truth = admitted.value;
  const chapter = { title: story.title, startNodeId: 'n1', variables: [{ id: 'connection', label: '联结', initial: 0 }], nodes: story.nodes, endings: story.endings };
  assert.equal(engine.admitChapter(truth, chapter, 'chapter-result', now).ok, false, 'approval gate enforced');
  assert.equal(engine.buildPreparedPackage({ pkg: truth, producer: 'author', now }).ok, false);
  truth = engine.approveBible({ ...truth, adaptationBrief: { ...truth.adaptationBrief, approval: 'approved' } }, now).value;
  const composed = engine.admitChapter(truth, chapter, 'real-result-fixture-chapter', now);
  assert.equal(composed.ok, true, JSON.stringify(composed));
  assert.ok(composed.value.evidence.some((e) => e.sourceRef === 'real-result-fixture-chapter'));
  const prepared = engine.buildPreparedPackage({ pkg: composed.value, producer: 'author', now });
  assert.equal(prepared.ok, true);
  assert.equal(engine.validatePreparedPackage(prepared.value).valid, true);
  assert.ok(!JSON.stringify(prepared.value.publicCast).includes(story.cast[0].privateFacts[0]));
});

test('malformed imported story data never reaches a renderer that expects complete nested fields', () => {
  const original = buildCuratedPackage(CURATED_STORIES[0], now).value;
  for (const change of [
    (p) => { p.playableChapters[0].nodes = null; },
    (p) => { p.playableChapters[0].nodes[0] = null; },
    (p) => { p.presentation.themes = {}; },
    (p) => { p.publicCast = [null]; },
    (p) => { p.assetManifest = [null]; },
    (p) => { p.startSemantics.nodeId = 'inn'; },
    (p) => { p.stateMatrix.variables.corrupt = { nested: true }; },
    (p) => { p.stateMatrix.variables.corrupt = Infinity; },
    (p) => { p.stateMatrix.flags.corrupt = 'true'; },
  ]) { const mutated = structuredClone(original); change(mutated); assert.doesNotThrow(() => engine.validatePreparedPackage(mutated)); assert.equal(engine.validatePreparedPackage(mutated).valid, false); }
});

test('prepared compatibility uses the actual package version', () => {
  const version = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const prepared = buildCuratedPackage(CURATED_STORIES[0], now).value;
  prepared.manifest.appCompatRange = { min: version, max: `${Number(version.split('.')[0]) + 1}.0.0` };
  assert.equal(engine.STORYBOOK_APP_VERSION, version);
  assert.equal(engine.validatePreparedPackage(prepared).valid, true);
  assert.equal(engine.validatePreparedPackage(prepared, { currentAppVersion: '0.0.1' }).valid, false);
});

test('an explicit chapter revision creates a new truth version without rewriting a prepared edition', () => {
  const story = CURATED_STORIES[1];
  const prepared = buildCuratedPackage(story, now).value;
  const initialBytes = JSON.stringify(prepared);
  const project = { id: 'revision-test', name: story.title, mode: 'document-backed', truthPackageId: 'truth-revision', createdAt: now, updatedAt: now };
  const conversion = engine.convertIntake({ kind: 'document-text', projectId: project.id, text: story.subtitle }, now).value;
  let truth = engine.seedTruthPackage(project, conversion, now);
  truth = engine.admitFoundation(truth, { title: story.title, premise: story.subtitle, world: '记忆中的列车', playerRole: story.role, tension: '告别与留下', style: '克制', themes: story.themes, cast: story.cast, endingDirection: '重新理解告别' }, 'foundation', now).value;
  truth = engine.approveBible({ ...truth, adaptationBrief: { ...truth.adaptationBrief, approval: 'approved' } }, now).value;
  const chapter = { title: story.title, startNodeId: 'n1', variables: [{ id: 'connection', label: '联结', initial: 0 }], nodes: structuredClone(story.nodes), endings: story.endings };
  truth = engine.admitChapter(truth, chapter, 'chapter', now).value;
  const version = truth.version;
  const changed = structuredClone(chapter); changed.nodes[0].text += '\n站台的灯在你身后亮着。';
  assert.equal(engine.admitChapter(truth, changed, 'revision', now).ok, false);
  const revised = engine.admitChapter(truth, changed, 'revision', now, { replace: true });
  assert.equal(revised.ok, true);
  assert.equal(revised.value.version, version + 1);
  assert.equal(truth.version, version);
  assert.equal(JSON.stringify(prepared), initialBytes);
});
