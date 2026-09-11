import assert from 'node:assert/strict';
import test from 'node:test';
import { createFileBackend } from './fixtures/native-file-backend.mjs';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
mkdirSync(path.join(root, '.nimi/local'), { recursive: true });
const out = mkdtempSync(path.join(root, '.nimi/local/protocol-tests-'));
execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '--outDir', out, '--rootDir', '.', '--resolveJsonModule', 'true', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022', '--skipLibCheck', 'true', '--strict', 'true', '--noEmit', 'false', 'src/storybook/engine/protocol/context.ts', 'src/storybook/engine/protocol/png.ts', 'src/storybook/store/storybook-store.ts', 'src/storybook/store/editor-session.ts'], { cwd: root, stdio: 'pipe' });
const load = name => import(pathToFileURL(path.join(out, `src/storybook/engine/protocol/${name}.js`)).href);
const v = await load('validate'); const s = await load('session'); const c = await load('context');
const { cardsFromPng } = await load('png');
const store = await import(pathToFileURL(path.join(out, 'src/storybook/store/storybook-store.js')).href);
const repository = await import(pathToFileURL(path.join(out, 'src/storybook/store/native-repository.js')).href);
const { createEditorSession } = await import(pathToFileURL(path.join(out, 'src/storybook/store/editor-session.js')).href);
const nativeDirectory = path.join(out, 'native-records');
await store.initializeStorybookStore(createFileBackend(nativeDirectory));
const fixture = name => JSON.parse(readFileSync(path.join(root, 'public/protocol/examples', name), 'utf8'));
const lin = fixture('lin.character.json'); const lu = fixture('lu.character.json');
const flow = fixture('branching-encounter.storybook.json'); const postcard = fixture('postcard.storybook.json');
const tide = fixture('tide-city.lorebook.json'); const cloud = fixture('cloud-station.lorebook.json');
const now = '2026-09-11T11:00:00.000Z';
test.after(() => rmSync(out, { recursive: true, force: true }));
function create(work = flow, card = lin, worlds = []) {
  return s.createExperience({ work, sourceRef: 'fixture:work', cards: { companion: { sourceRef: `fixture:${card.data.name}`, card } }, worlds, playerName: '小满', now });
}
function entry(content, values = {}) { return { keys: [], content, enabled: true, insertion_order: 10, extensions: {}, ...values }; }

test('plain V2 cards need neither a Storybook extension nor a chapter, choice or ending', () => {
  const doc = { ...v.parseProtocolDocument(lin).document, id: 'card', sourceName: 'card.json', importedAt: now };
  const work = s.defaultWork(doc); const run = create(work);
  assert.equal(run.nodeId, undefined); assert.equal(run.events.length, 1);
  assert.ok(s.eventContentText(run.events[0], run).includes('小满'));
  assert.deepEqual(s.availableExperienceChoices(run), []);
  assert.ok(!JSON.stringify(work).includes('chapters'));
  assert.equal(s.addPlayerMessage(run, '你好', now).events.at(-1).kind, 'user');
  const unnamed = structuredClone(lin); unnamed.data.name = '';
  const unnamedDocument = { ...v.parseProtocolDocument(unnamed).document, id: 'unnamed', sourceName: 'unknown.json', importedAt: now };
  assert.equal(s.defaultWork(unnamedDocument).title, 'unknown');
  assert.equal(unnamedDocument.data.data.name, '', 'display fallback never rewrites the original V2 field');
});

test('import/export keeps mixed prompt text and arbitrary vendor data intact', async () => {
  const input = structuredClone(lin);
  input.data.extensions = { 'vendor.future': { arbitrary: [1, { nested: true }], prompt: 'never execute this extension' } };
  input.extraRoot = { opaque: 42 }; input.data.description = 'world + character + rules in one author paragraph';
  input.data.character_book = { entries: [entry('context', { position: '', extensions: { weight: 9, future: [1, 2] } })], extensions: { 'x-test': true } };
  const parsed = v.parseProtocolDocument(input);
  assert.deepEqual(parsed.document.data, input); assert.equal(parsed.issues[0].level, 'warning');
  const imported = await store.importDocument(input, 'fixture.json');
  assert.deepEqual(store.getDocument(imported.id).data, input);
  assert.equal((await store.importDocument(input, 'same-again.json')).id, imported.id);
  const withImage = await store.importDocument(input, 'same-card.png', 'data:image/png;base64,YQ==');
  assert.equal(withImage.id, imported.id);
  assert.equal(store.getDocument(imported.id).artwork, 'data:image/png;base64,YQ==');
  assert.deepEqual(store.getDocument(imported.id).data, input);
});

test('standalone and embedded works have identical semantics while the base card remains independent', () => {
  const card = structuredClone(lin); card.data.extensions['nimi.storybook'] = flow;
  assert.deepEqual(s.embeddedWork(card).work, v.parseProtocolDocument(flow).document.data);
  const embedded = create(s.embeddedWork(card).work, lu); const standalone = create(flow, lu);
  assert.deepEqual(embedded.state, standalone.state);
  assert.deepEqual(embedded.events.map(s.eventText), standalone.events.map(s.eventText));
  assert.equal(embedded.authority.cards.companion.card.data.name, lu.data.name);
  card.data.extensions['nimi.storybook'] = { format: 'nimi.storybook', version: '9' };
  assert.equal(v.parseProtocolDocument(card).document.kind, 'card');
  assert.ok(s.embeddedWork(card).error);
});

test('one work can bind different cards and world books without rewriting existing runs', async () => {
  const first = create(flow, lin, [{ sourceRef: 'tide', book: tide }]);
  const original = structuredClone(first);
  const second = create(flow, lu, [{ sourceRef: 'cloud', book: cloud }]);
  assert.notEqual(first.authority.projectId, second.authority.projectId);
  second.authority.cards.companion.card.data.description = 'changed locally';
  assert.deepEqual(first, original); assert.notEqual(lu.data.description, 'changed locally');
  await store.saveExperienceRun(first);
  const illegal = structuredClone(first); illegal.authority.cards.companion.card = lu;
  await assert.rejects(() => store.saveExperienceRun(illegal), /不能更换设定/);
  assert.deepEqual(store.getExperienceRun(first.id).authority, original.authority);
  assert.throws(() => { store.getExperienceRun(first.id).authority.work.title = 'silently rewritten'; }, TypeError);
});

test('work-owned default cards and world refs are resolved by admission independently of UI', () => {
  const image = { uri: 'data:image/png;base64,YQ==', mimeType: 'image/png' };
  const work = s.workWithCard(flow, 'companion', lin, image);
  work.resources.world = { type: 'lorebook', book: tide };
  work.modules['nimi.storybook.conversation'].config.worlds = ['world'];
  const run = s.createExperience({ work, sourceRef: 'work', cards: {}, playerName: '你', now });
  assert.equal(run.authority.cards.companion.card.data.name, '林');
  assert.equal(run.authority.cards.companion.artwork, image.uri);
  assert.deepEqual(work.resources[work.roles.companion.card].card, lin);
  assert.equal(run.authority.worlds[0].book.name, '潮汐城');
  assert.ok(run.authority.sourceRefs.includes('work#resources/world'));
});

test('V2 prompt replacement and post-history ordering exclude human-facing metadata', () => {
  const card = structuredClone(lin);
  card.data.creator_notes = 'METADATA_NOTE_SENTINEL'; card.data.tags = ['METADATA_TAG_SENTINEL'];
  card.data.creator = 'METADATA_CREATOR_SENTINEL'; card.data.character_version = 'METADATA_VERSION_SENTINEL';
  card.data.system_prompt = 'CARD_SYSTEM_ONLY {{char}} {{user}}';
  card.data.post_history_instructions = 'POST_HISTORY_ONLY {{user}}';
  card.data.mes_example = 'EXAMPLE_KEEP';
  let run = create(undefined, card); run = s.addPlayerMessage(run, 'CURRENT_PLAYER_SENTINEL', now);
  const { messages } = c.buildExperienceContext(run); const all = messages.map(m => m.text).join('\n');
  assert.ok(all.startsWith('CARD_SYSTEM_ONLY 林 小满')); assert.ok(all.includes('EXAMPLE_KEEP'));
  assert.ok(!all.includes('METADATA_')); assert.ok(!all.includes('参与这场互动体验。'));
  assert.equal(messages.at(-1).text, 'POST_HISTORY_ONLY 小满');
  assert.equal(messages.at(-2).text, 'CURRENT_PLAYER_SENTINEL');
  card.data.system_prompt = '{{original}}\nEXTRA_SYSTEM';
  run = s.addPlayerMessage(create(undefined, card), '你好', now);
  assert.ok(c.buildExperienceContext(run).messages[0].text.includes('参与这场互动体验。'));
  assert.ok(c.buildExperienceContext(run).messages[0].text.includes('EXTRA_SYSTEM'));
});

test('lore respects enabled, constant, selective, case, recursion, depth and metadata exclusion', () => {
  const book = { extensions: {}, name: 'BOOK_NAME_NEVER_PROMPT', scan_depth: 1, token_budget: 1000, recursive_scanning: true, entries: [
    entry('BASE_CONTEXT', { constant: true, position: 'before_char' }),
    entry('harbor TRIGGER', { keys: ['Map'], case_sensitive: true }),
    entry('RECURSIVE_CONTEXT', { keys: ['TRIGGER'] }),
    entry('SELECTIVE_CONTEXT', { keys: ['map'], selective: true, secondary_keys: ['rain'] }),
    entry('DISABLED_CONTEXT', { enabled: false, constant: true }),
    entry('OLD_CONTEXT', { keys: ['old'] }),
  ] };
  let result = c.activateLore({ books: [{ ref: 'book', book }], history: ['old', 'Map rain'], char: '林', user: '你' });
  assert.deepEqual(result.before, ['BASE_CONTEXT']);
  assert.deepEqual(result.after, ['harbor TRIGGER', 'RECURSIVE_CONTEXT', 'SELECTIVE_CONTEXT']);
  assert.ok(!JSON.stringify(result).includes('BOOK_NAME_NEVER_PROMPT'));
  result = c.activateLore({ books: [{ ref: 'book', book }], history: ['map'], char: '林', user: '你' });
  assert.deepEqual(result.after, []);
  book.scan_depth = 0;
  assert.deepEqual(c.activateLore({ books: [{ ref: 'book', book }], history: ['Map rain'], char: '林', user: '你' }).after, []);
});

test('lore budget prefers priority, preserves insertion ordering and deduplicates overlapping books', () => {
  const book = { extensions: {}, token_budget: 2, entries: [entry('AAAA', { constant: true, priority: 1 }), entry('BBBB', { constant: true, priority: 2, insertion_order: 2 }), entry('CCCC', { constant: true, priority: 3, insertion_order: 1 })] };
  const result = c.activateLore({ books: [{ ref: 'character', book }, { ref: 'world', book }], history: [], char: 'c', user: 'u' });
  assert.deepEqual(result.after, ['CCCC', 'BBBB', 'AAAA']);
  assert.equal(result.refs.length, 3); assert.equal(result.tokens, 3);
  book.token_budget = 0;
  assert.equal(c.activateLore({ books: [{ ref: 'book', book }], history: [], char: '', user: '' }).refs.length, 0);
});

test('history is bounded by bytes, retained locally and never silently truncates card authority', () => {
  let run = create();
  for (let i = 0; i < 30; i++) run = s.addPlayerMessage(run, `${i}:` + '长'.repeat(1200), now);
  const context = c.buildExperienceContext(run);
  assert.ok(context.trace.omittedTurns > 0);
  assert.equal(run.events.length, 31);
  assert.ok(context.messages.length <= 8);
  assert.ok(context.messages.reduce((n, m) => n + Buffer.byteLength(m.text) + m.role.length, 0) <= 65536);
  run.authority.cards.companion.card.data.description = '长'.repeat(20000);
  assert.throws(() => c.buildExperienceContext(run), /上下文容量/);
});

test('conditional branching and replay restore past state and omit the abandoned future', () => {
  const start = create(); const first = s.chooseExperience(start, 'past', now);
  assert.equal(first.nodeId, 'memory'); assert.equal(first.state.topic, 'memory');
  const spoken = s.addPlayerMessage(first, 'FUTURE_SHOULD_DISAPPEAR', now);
  const ended = s.chooseExperience(spoken, 'stay', now); const original = structuredClone(ended);
  const fork = s.forkExperience(ended, ended.checkpoints[0].id, now);
  assert.equal(fork.nodeId, 'meet'); assert.equal(fork.state.topic, 'none');
  assert.ok(!JSON.stringify(fork.events).includes('FUTURE_SHOULD_DISAPPEAR'));
  assert.deepEqual(ended, original);
  assert.equal(s.chooseExperience(fork, 'future', now).nodeId, 'future');
});

test('declared flow loops remain valid while impossible current choices fail before mutation', () => {
  const work = structuredClone(flow); work.modules['nimi.storybook.flow'].config.nodes[1].choices[0].target = 'meet';
  assert.equal(v.validateWork(work).filter(i => i.level === 'error').length, 0);
  let run = create(work); run = s.chooseExperience(run, 'past', now); run = s.chooseExperience(run, 'stay', now);
  assert.equal(run.nodeId, 'meet'); assert.equal(run.visit, 3);
  work.modules['nimi.storybook.flow'].config.nodes[0].dialogue = false;
  work.modules['nimi.storybook.flow'].config.nodes[0].choices.forEach(c => { c.when = { topic: 'impossible' }; });
  assert.throws(() => create(work), /没有可用的行动/);
});

test('malformed resources, state writes, module configs and task dependency cycles never reach Play', () => {
  for (const mutate of [
    w => { w.modules['nimi.storybook.flow'].config.nodes[0].choices[0].target = 'absent'; },
    w => { w.modules['nimi.storybook.flow'].config.nodes[0].choices[0].set = { undeclared: 1 }; },
    w => { w.modules['nimi.storybook.flow'].config.nodes[0].content = [{ type: 'resource', ref: 'absent' }]; },
    w => { w.modules['nimi.storybook.flow'].config.nodes[0].content = [{ type: 'text', text: 'hi', alt: {} }]; },
    w => { w.roles.companion.card = 'absent'; },
    w => { w.modules['nimi.storybook.conversation'].config = null; },
  ]) { const changed = structuredClone(flow); mutate(changed); assert.throws(() => v.parseProtocolDocument(changed)); }
  const work = structuredClone(postcard); const tasks = work.modules['nimi.storybook.generation'].config.tasks;
  tasks[0].dependsOn = ['picture'];
  assert.throws(() => v.parseProtocolDocument(work), /循环/);
  tasks[0].dependsOn = []; tasks[1].dependsOn = [];
  assert.throws(() => v.parseProtocolDocument(work), /显式声明依赖/);
});

test('unknown optional modules survive round-trip while unknown required modules block admission', () => {
  const work = structuredClone(flow);
  work.modules['example.hologram'] = { version: '12', config: { anyFutureMeaning: { enabled: true } } };
  assert.deepEqual(v.parseProtocolDocument(work).document.data, work);
  assert.equal(v.inspectWorkSupport(work)[0].blocking, false);
  assert.ok(create(work));
  work.modules['example.hologram'].required = true;
  assert.equal(v.inspectWorkSupport(work)[0].blocking, true);
  assert.throws(() => create(work), /hologram/);
});

test('multimodal task contracts survive import and required capability checks include dependencies', () => {
  for (const kind of ['image','music','speech','sound','video']) {
    const work = structuredClone(postcard); const tasks = work.modules['nimi.storybook.generation'].config.tasks;
    tasks[1].capability = `${kind}.generate`; tasks[1].outputs[0].kind = kind; tasks[1].required = true;
    assert.equal(v.parseProtocolDocument(work).document.kind, 'work');
    assert.equal(v.inspectWorkSupport(work).some(i => i.blocking), false, 'explicit fallback admits the experience');
    delete tasks[1].fallback;
    assert.equal(v.inspectWorkSupport(work).some(i => i.blocking), true);
  }
  const work = structuredClone(postcard); const tasks = work.modules['nimi.storybook.generation'].config.tasks;
  tasks[0].capability = 'unknown.generate'; tasks[1].required = true; delete tasks[1].fallback;
  assert.ok(v.inspectWorkSupport(work).find(i => i.id === 'letter').blocking);
  const inline = structuredClone(postcard);
  const media = { type: 'media', uri: './stories/garden.jpg', mimeType: 'image/jpeg', alt: '预置插画' };
  inline.modules['nimi.storybook.conversation'].config.opening = [media];
  assert.equal(v.parseProtocolDocument(inline).document.kind, 'work');
  const task = inline.modules['nimi.storybook.generation'].config.tasks[0];
  task.inputs = [media];
  assert.match(v.taskSupport(task, inline), /媒体输入/);
});

test('unavailable media remains unavailable and only explicit authored fallback satisfies required tasks', () => {
  const work = structuredClone(postcard); const task = work.modules['nimi.storybook.generation'].config.tasks[1]; task.required = true;
  let run = create(work);
  assert.equal(s.requiredTasksPending(run).length, 1);
  run.attempts.push({ id: 'typed-unavailable-fixture', projectId: run.authority.projectId, request: { kind: 'task', visit: 0 }, taskId: 'picture', scope: 'run', capability: 'image.generate', status: 'unavailable', reason: 'capability-unavailable', outputs: {}, inputRefs: [], createdAt: now });
  assert.equal(s.requiredTasksPending(run).length, 0);
  assert.deepEqual(s.outputParts(run, 'picture', 'image'), task.fallback);
  assert.equal(run.attempts[0].status, 'unavailable');
  assert.deepEqual(run.attempts[0].outputs, {});
});

test('safe media URLs permit typed media but never script, local-file or SVG execution', () => {
  assert.equal(v.safeMediaUri('https://example.org/image.jpg'), 'https://example.org/image.jpg');
  assert.equal(v.safeMediaUri('./stories/garden.jpg'), './stories/garden.jpg');
  for (const uri of ['javascript:alert(1)', 'file:///etc/passwd', 'data:image/svg+xml;base64,abc', '//example.org/a.jpg']) assert.equal(v.safeMediaUri(uri), undefined);
});

test('PNG character-card reader decodes real metadata bytes, rejects truncation and missing cards', () => {
  function chunk(type, bytes) { const buf = Buffer.alloc(bytes.length + 12); buf.writeUInt32BE(bytes.length); buf.write(type, 4); bytes.copy(buf, 8); return buf; }
  const data = Buffer.from(JSON.stringify(lin)).toString('base64');
  const bytes = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('tEXt', Buffer.from(`chara\0${data}`)), chunk('IEND', Buffer.alloc(0))]);
  assert.deepEqual(cardsFromPng(bytes).cards[0], lin);
  assert.throws(() => cardsFromPng(bytes.subarray(0, 40)), /不完整/);
  assert.throws(() => cardsFromPng(Buffer.from('not an image')), /PNG/);
});

test('committed repository records are real files and a cold repository can restore them', async () => {
  const work = structuredClone(postcard); work.title = 'native persistence fixture';
  const document = await store.importDocument(work, 'native.json');
  const path = repository.recordPath('documents', document.id);
  assert.ok(existsSync(`${nativeDirectory}/${path}`));
  assert.deepEqual(JSON.parse(readFileSync(`${nativeDirectory}/${path}`, 'utf8')).data, work);
  const cold = await import(pathToFileURL(`${out}/src/storybook/store/native-repository.js`).href + '?cold');
  await cold.initializeStorybookStore(createFileBackend(nativeDirectory));
  assert.deepEqual(cold.getRecord('documents', document.id).data, work);
});

test('an unavailable native store does not create an empty or memory-only product store', async () => {
  const cold = await import(pathToFileURL(`${out}/src/storybook/store/native-repository.js`).href + '?unavailable');
  await assert.rejects(cold.initializeStorybookStore({ async list() { throw new Error('native host unavailable'); } }), /native host unavailable/);
  assert.equal(cold.isStorybookStoreReady(), false);
  assert.throws(() => cold.allRecords('documents'), /本机内容库尚未打开/);
});

test('editor working copies merge immediate edits and preserve input after a real file write failure', async () => {
  const directory = path.join(out, 'editor-files'); const backend = createFileBackend(directory);
  const editor = createEditorSession({ title: 'original', world: 'old', revisionNote: '' }, value => backend.write('project.json', value));
  const title = editor.update(current => ({ ...current, title: 'new title' }));
  const world = editor.update(current => ({ ...current, world: 'new world' }));
  assert.equal(editor.getSnapshot().value.title, 'new title');
  await Promise.all([title, world]);
  await editor.update(current => ({ ...current, revisionNote: 'keep the author note' }));
  await editor.update(current => ({ ...current, world: 'advanced edit' }));
  assert.deepEqual(await backend.read('project.json'), { title: 'new title', world: 'advanced edit', revisionNote: 'keep the author note' });
  mkdirSync(path.join(directory, 'project.json.tmp'));
  await assert.rejects(editor.update(current => ({ ...current, title: 'retained after failure' })), /EISDIR/);
  assert.equal(editor.getSnapshot().status, 'error');
  assert.equal(editor.getSnapshot().value.title, 'retained after failure');
  assert.equal((await backend.read('project.json')).title, 'new title');
  rmSync(path.join(directory, 'project.json.tmp'), { recursive: true });
  await editor.flush();
  assert.equal((await backend.read('project.json')).title, 'retained after failure');
  assert.equal(editor.getSnapshot().status, 'saved');
});

test('work drafts retain separate identities and publishing updates one document while existing runs retain their snapshot', async () => {
  const a = await store.importDocument({ ...flow, title: 'draft A' }, 'a.json');
  const b = await store.importDocument({ ...flow, title: 'draft B' }, 'b.json');
  await store.saveWorkDraft(a.id, JSON.stringify({ ...a.data, summary: 'unpublished A' }));
  await store.saveWorkDraft(b.id, JSON.stringify({ ...b.data, summary: 'unpublished B' }));
  assert.equal(JSON.parse(store.getWorkDraft(a.id).text).summary, 'unpublished A');
  assert.equal(JSON.parse(store.getWorkDraft(b.id).text).summary, 'unpublished B');
  const run = create(a.data); await store.saveExperienceRun(run);
  const original = structuredClone(store.getExperienceRun(run.id));
  const count = store.listDocuments().length;
  await store.saveWork(a.id, { ...a.data, summary: 'published A' });
  assert.equal(store.listDocuments().length, count);
  assert.equal(store.getDocument(a.id).data.summary, 'published A');
  assert.deepEqual(store.getExperienceRun(run.id), original);
  await store.clearWorkDraft(a.id);
  assert.equal(store.getWorkDraft(a.id), null);
  assert.equal(JSON.parse(store.getWorkDraft(b.id).text).summary, 'unpublished B');
});

test('PNG candidates deduplicate identical data, retain conflicts and expose invalid candidate reasons', () => {
  function chunk(type, bytes) { const buf = Buffer.alloc(bytes.length + 12); buf.writeUInt32BE(bytes.length); buf.write(type, 4); bytes.copy(buf, 8); return buf; }
  const encode = text => chunk('tEXt', Buffer.from(`chara\0${Buffer.from(text).toString('base64')}`));
  const png = (...texts) => Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), ...texts.map(encode), chunk('IEND', Buffer.alloc(0))]);
  const same = cardsFromPng(png(JSON.stringify(lin), JSON.stringify(lin, null, 2)));
  assert.equal(same.cards.length, 1); assert.deepEqual(same.cards[0], lin);
  const conflict = cardsFromPng(png(JSON.stringify(lin), JSON.stringify(lu)));
  assert.deepEqual(conflict.cards.map(card => card.data.name), [lin.data.name, lu.data.name]);
  const mixed = cardsFromPng(png('invalid JSON', JSON.stringify(lin)));
  assert.equal(mixed.cards.length, 1); assert.equal(mixed.warnings.length, 1);
  assert.throws(() => cardsFromPng(png('invalid JSON')), /无法使用/);
});

test('V2 normalization fills specified empty containers without mutating the original or losing unknown fields', () => {
  const card = structuredClone(lin); delete card.data.extensions;
  card.data.character_book = { entries: [{ ...entry('lore'), extensions: undefined, unknown: { retained: true } }] };
  const result = v.parseProtocolDocument(card).document.data;
  assert.deepEqual(result.data.extensions, {});
  assert.deepEqual(result.data.character_book.extensions, {});
  assert.deepEqual(result.data.character_book.entries[0].extensions, {});
  assert.deepEqual(result.data.character_book.entries[0].unknown, { retained: true });
  assert.equal(Object.hasOwn(card.data, 'extensions'), false);
  assert.equal(s.substitute('<bOt> greets <uSeR> and {{USER}}', 'Guide', 'Player'), 'Guide greets Player and Player');
});

test('registered task enum arrays and incompatible visit dependencies are rejected before admission', () => {
  const work = { format: 'nimi.storybook', version: '0.1.0', title: 'scope validation', modules: {
    'nimi.storybook.flow': { version: '1', config: { entry: 'a', nodes: [{ id: 'a', choices: [{ id: 'next', label: 'next', target: 'b' }] }, { id: 'b' }] } },
    'nimi.storybook.generation': { version: '1', config: { tasks: [
      { id: 'a', label: 'a', capability: 'text.generate', inputs: [{ type: 'text', text: 'a' }], outputs: [{ id: 'out', kind: 'text' }], trigger: { event: 'manual', node: 'a' }, reuse: 'visit' },
      { id: 'b', label: 'b', capability: 'text.generate', inputs: [{ type: 'text', text: 'b' }], outputs: [{ id: 'out', kind: 'text' }], trigger: { event: 'manual', node: 'b' }, reuse: 'visit', dependsOn: ['a'], required: true },
    ] } },
  } };
  assert.throws(() => v.parseProtocolDocument(work), /跨场景依赖/);
  const tasks = work.modules['nimi.storybook.generation'].config.tasks;
  tasks[0].reuse = 'run'; assert.doesNotThrow(() => v.parseProtocolDocument(work));
  tasks[0].trigger.event = ['enter']; assert.throws(() => v.parseProtocolDocument(work), /字符串/);
  tasks[0].trigger.event = 'manual'; tasks[0].reuse = ['run']; assert.throws(() => v.parseProtocolDocument(work), /字符串/);
});

test('unrenderable required fallbacks block admission and never unlock an already retained run', () => {
  const work = structuredClone(postcard);
  const task = work.modules['nimi.storybook.generation'].config.tasks[1];
  work.resources.opaque = { type: 'x-audit', note: 'not display content' };
  task.required = true; task.fallback = [{ type: 'resource', ref: 'opaque' }];
  assert.equal(v.hasUsableFallback(task, work), false);
  assert.ok(v.inspectWorkSupport(work).some(issue => issue.blocking));
  assert.throws(() => create(work));
  task.fallback = [{ type: 'text', text: 'author fallback' }];
  const run = create(work);
  const retained = structuredClone(run); const retainedTask = retained.authority.work.modules['nimi.storybook.generation'].config.tasks[1];
  retainedTask.fallback = [{ type: 'resource', ref: 'opaque' }];
  retained.attempts.push({ id: 'unavailable', taskId: retainedTask.id, scope: s.taskScope(retained, retainedTask), status: 'unavailable', outputs: {} });
  assert.ok(s.requiredTasksPending(retained).some(t => t.id === retainedTask.id));
  assert.deepEqual(s.outputParts(retained, retainedTask.id, retainedTask.outputs[0].id), []);
});

test('required statically empty text inputs are unsupported while authored alternatives and dynamic text remain possible', () => {
  for (const inputs of [[], [{ type: 'text', text: '   ' }], [{ type: 'resource', ref: 'empty' }]]) {
    const task = { id: 'task', label: 'Task', capability: 'text.generate', inputs, outputs: [{ id: 'text', kind: 'text' }], required: true, trigger: { event: 'manual' }, reuse: 'run' };
    const work = { format: 'nimi.storybook', version: '0.1.0', title: 'Empty input', resources: { empty: { type: 'text', text: '' } }, modules: { 'nimi.storybook.generation': { version: '1', config: { tasks: [task] } } } };
    assert.match(v.taskSupport(task, work), /非空/);
    assert.throws(() => s.createExperience({ work, sourceRef: 'empty', cards: {}, playerName: 'Player', now }), /非空/);
    task.fallback = [{ type: 'text', text: 'An authored alternative' }];
    assert.doesNotThrow(() => s.createExperience({ work, sourceRef: 'fallback', cards: {}, playerName: 'Player', now }));
  }
});

test('future-node prerequisites are rejected without banning valid earlier-node or alternate-path run reuse', () => {
  const task = (id, node, required = false) => ({ id, label: id, capability: 'text.generate', inputs: [{ type: 'text', text: id }], outputs: [{ id: 'text', kind: 'text' }], trigger: { event: 'manual', node }, reuse: 'run', required });
  const future = task('future', 'b'); const gate = { ...task('gate', 'a', true), dependsOn: ['future'] };
  const work = { format: 'nimi.storybook', version: '0.1.0', title: 'Temporal dependency', modules: {
    'nimi.storybook.flow': { version: '1', config: { entry: 'a', nodes: [{ id: 'a', choices: [{ id: 'next', label: 'Next', target: 'b' }] }, { id: 'b', choices: [{ id: 'back', label: 'Back', target: 'a' }] }] } },
    'nimi.storybook.generation': { version: '1', config: { tasks: [future, gate] } },
  } };
  assert.throws(() => v.parseProtocolDocument(work), /尚不可到达/);
  work.modules['nimi.storybook.flow'].config.entry = 'b';
  assert.doesNotThrow(() => v.parseProtocolDocument(work));
  work.modules['nimi.storybook.flow'].config.nodes.unshift({ id: 'entry', choices: [{ id: 'b', label: 'Prepare', target: 'b' }, { id: 'a', label: 'Other path', target: 'a' }] });
  work.modules['nimi.storybook.flow'].config.entry = 'entry';
  assert.doesNotThrow(() => v.parseProtocolDocument(work), 'over-approximation must not pretend to prove every route');
});

test('world composition retains existing resource ids and cover content', () => {
  const work = { ...flow, cover: 'world-1', resources: { 'world-1': { type: 'media', uri: 'https://example.org/cover.png', mimeType: 'image/png' } } };
  const original = structuredClone(work);
  const combined = s.workWithWorlds(work, [cloud, tide]);
  assert.deepEqual(work, original); assert.deepEqual(combined.resources['world-1'], original.resources['world-1']);
  assert.deepEqual(combined.modules['nimi.storybook.conversation'].config.worlds, ['world-2', 'world-3']);
  assert.equal(v.validateWork(combined).filter(issue => issue.level === 'error').length, 0);
  assert.deepEqual(s.workWithWorlds(combined, [cloud, tide]).resources, combined.resources);
});

test('authored event names, inference history and lore agree while player text stays literal across role changes', () => {
  const card = structuredClone(lin); card.data.name = 'Alice';
  card.data.character_book = { extensions: {}, entries: [entry('MATCHING_LORE', { keys: ['Alice gives 小满'] })] };
  const work = { ...flow, modules: { 'nimi.storybook.conversation': { version: '1', config: { opening: [{ type: 'text', text: '{{char}} gives {{user}} a map.' }] } } } };
  let run = create(work, card);
  assert.equal(s.eventContentText(run.events[0], run), 'Alice gives 小满 a map.');
  run = s.addPlayerMessage(run, 'Keep {{char}} literally in my message.', now);
  assert.equal(s.eventContentText(run.events.at(-1), run), 'Keep {{char}} literally in my message.');
  const context = c.buildExperienceContext(run);
  assert.equal(context.trace.activatedLore.length, 1);
  const history = context.messages.find(m => m.text.startsWith('Previous events'));
  assert.match(history.text, /Alice gives 小满/); assert.doesNotMatch(history.text, /\{\{char\}\}/);
  assert.equal(context.messages.at(-1).text, 'Keep {{char}} literally in my message.');
  const two = { ...work, roles: { ...work.roles, other: { label: 'Other' } } };
  const both = s.createExperience({ work: two, sourceRef: 'roles', cards: { companion: { sourceRef: 'alice', card }, other: { sourceRef: 'bob', card: { ...card, data: { ...card.data, name: 'Bob' } } } }, playerName: '小满', now });
  assert.equal(s.eventContentText(both.events[0], { ...both, roleId: 'other' }), 'Alice gives 小满 a map.');
  const withScene = { ...two, modules: { ...two.modules, 'nimi.storybook.flow': { version: '1', config: { entry: 'scene', nodes: [{ id: 'scene', content: [{ type: 'text', text: '{{char}} meets {{user}}.' }] }] } } } };
  const entered = s.createExperience({ work: withScene, sourceRef: 'scene-roles', cards: both.authority.cards, playerName: '小满', now });
  const switched = s.addPlayerMessage({ ...entered, roleId: 'other' }, 'Hello', now);
  const sceneContext = c.buildExperienceContext(switched).messages[0].text.split('Current authored scene:')[1];
  assert.match(sceneContext, /Alice meets 小满/); assert.doesNotMatch(sceneContext, /Bob meets/);
});
