import {
  CONVERSATION, FLOW, GENERATION, conversationOf, flowOf, tasksOf,
  type CharacterCardV2, type Lorebook, type ProtocolDocument, type ProtocolIssue,
  type StorybookWork, type ContentPart, type SupportIssue, type GenerationTask,
} from './types.js';

export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
const stringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');
const scalar = (v: unknown) => typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v));
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,95}$/.test(v) && !['__proto__', 'constructor', 'prototype'].includes(v);
const nonempty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

export function validateLorebook(value: unknown, path = 'character_book'): ProtocolIssue[] {
  const issues: ProtocolIssue[] = [];
  const bad = (p: string, message: string) => issues.push({ path: p, message, level: 'error' });
  if (!record(value) || !Array.isArray(value.entries)) return [{ path, message: '世界资料需要 entries 数组。', level: 'error' }];
  for (const key of ['name', 'description']) if (value[key] !== undefined && typeof value[key] !== 'string') bad(`${path}.${key}`, '应为文字。');
  if (value.extensions !== undefined && !record(value.extensions)) bad(`${path}.extensions`, '应为对象。');
  for (const key of ['scan_depth', 'token_budget']) if (value[key] !== undefined && (!Number.isSafeInteger(value[key]) || Number(value[key]) < 0)) bad(`${path}.${key}`, '应为非负整数。');
  if (value.recursive_scanning !== undefined && typeof value.recursive_scanning !== 'boolean') bad(`${path}.recursive_scanning`, '应为布尔值。');
  value.entries.forEach((entry, index) => {
    const p = `${path}.entries[${index}]`;
    if (!record(entry)) { bad(p, '条目需要是对象。'); return; }
    if (!stringArray(entry.keys) || typeof entry.content !== 'string' || typeof entry.enabled !== 'boolean' || !Number.isFinite(entry.insertion_order)) bad(p, '条目需要 keys、content、enabled 和 insertion_order。');
    if (entry.extensions !== undefined && !record(entry.extensions)) bad(`${p}.extensions`, '应为对象。');
    for (const key of ['case_sensitive', 'selective', 'constant']) if (entry[key] !== undefined && typeof entry[key] !== 'boolean') bad(`${p}.${key}`, '应为布尔值。');
    if (entry.secondary_keys !== undefined && !stringArray(entry.secondary_keys)) bad(`${p}.secondary_keys`, '应为文字数组。');
    if (entry.priority !== undefined && !Number.isFinite(entry.priority)) bad(`${p}.priority`, '应为有限数值。');
    if (entry.position !== undefined && !['before_char', 'after_char'].includes(String(entry.position))) issues.push({ path: `${p}.position`, message: '未识别的插入位置按 after_char 使用，原值保留。', level: 'warning' });
  });
  return issues;
}

// @nimi-authority: rule.storybook.protocol.r002
export function validateCard(value: unknown, path = 'card'): ProtocolIssue[] {
  if (!record(value) || value.spec !== 'chara_card_v2' || value.spec_version !== '2.0' || !record(value.data)) return [{ path, message: '需要 Character Card V2（chara_card_v2 / 2.0）。', level: 'error' }];
  const d = value.data;
  const issues: ProtocolIssue[] = [];
  for (const key of ['name', 'description', 'personality', 'scenario', 'first_mes', 'mes_example', 'creator_notes', 'system_prompt', 'post_history_instructions', 'creator', 'character_version']) {
    if (typeof d[key] !== 'string') issues.push({ path: `${path}.data.${key}`, message: 'V2 字段需要是文字，可以为空。', level: 'error' });
  }
  for (const key of ['alternate_greetings', 'tags']) if (!stringArray(d[key])) issues.push({ path: `${path}.data.${key}`, message: '应为文字数组。', level: 'error' });
  if (d.extensions !== undefined && !record(d.extensions)) issues.push({ path: `${path}.data.extensions`, message: '应为对象。', level: 'error' });
  if (d.character_book !== undefined) issues.push(...validateLorebook(d.character_book, `${path}.data.character_book`));
  return issues;
}

// @nimi-authority: rule.storybook.protocol.r003
export function validateWork(value: unknown): ProtocolIssue[] {
  const issues: ProtocolIssue[] = [];
  const bad = (path: string, message: string) => issues.push({ path, message, level: 'error' });
  if (!record(value)) return [{ path: '$', message: '作品需要是 JSON 对象。', level: 'error' }];
  if (value.format !== 'nimi.storybook' || value.version !== '0.1.0') bad('version', '当前支持 nimi.storybook 0.1.0。');
  if (!nonempty(value.title)) bad('title', '作品需要一个标题。');
  if (value.summary !== undefined && typeof value.summary !== 'string') bad('summary', '简介应为文字。');
  for (const key of ['resources', 'roles', 'modules', 'extensions']) if (value[key] !== undefined && !record(value[key])) bad(key, '应为对象。');
  const resources = record(value.resources) ? value.resources : {};
  const roles = record(value.roles) ? value.roles : {};
  const modules = record(value.modules) ? value.modules : {};
  const knownRef = (ref: unknown, p: string, type?: string) => {
    if (typeof ref !== 'string' || !Object.hasOwn(resources, ref)) { bad(p, '找不到引用的资源。'); return; }
    if (type && (!record(resources[ref]) || resources[ref].type !== type)) bad(p, `需要 ${type} 类型的资源。`);
  };
  for (const [key, r] of Object.entries(resources)) {
    if (!id(key)) bad(`resources.${key}`, '资源 ID 需要是简短的字母、数字、点、横线或下划线。');
    if (!record(r) || !nonempty(r.type)) { bad(`resources.${key}`, '资源需要 type。'); continue; }
    if (r.type === 'character') issues.push(...validateCard(r.card, `resources.${key}.card`));
    else if (r.type === 'lorebook') issues.push(...validateLorebook(r.book, `resources.${key}.book`));
    else if (r.type === 'text' && typeof r.text !== 'string') bad(`resources.${key}.text`, '需要文字。');
    else if (r.type === 'media' && (!nonempty(r.uri) || !nonempty(r.mimeType))) bad(`resources.${key}`, '媒体需要 uri 和 mimeType。');
    else if (!['character', 'lorebook', 'text', 'media'].includes(r.type) && !r.type.startsWith('x-')) bad(`resources.${key}.type`, '自定义资源类型使用 x- 命名。');
    if (r.type === 'media') for (const prop of ['alt', 'purpose']) if (r[prop] !== undefined && typeof r[prop] !== 'string') bad(`resources.${key}.${prop}`, '应为文字。');
    if (r.type === 'character' && r.portrait !== undefined) knownRef(r.portrait, `resources.${key}.portrait`, 'media');
  }
  if (value.cover !== undefined) knownRef(value.cover, 'cover', 'media');
  for (const [key, slot] of Object.entries(roles)) {
    if (!id(key) || !record(slot) || !nonempty(slot.label)) { bad(`roles.${key}`, '角色位置需要 ID 和 label。'); continue; }
    if (slot.card !== undefined) knownRef(slot.card, `roles.${key}.card`, 'character');
    if (slot.required !== undefined && typeof slot.required !== 'boolean') bad(`roles.${key}.required`, '应为布尔值。');
  }
  for (const [key, m] of Object.entries(modules)) {
    if (!key.includes('.') || !record(m) || !nonempty(m.version) || !Object.hasOwn(m, 'config')) bad(`modules.${key}`, '模块需要命名空间、version 和 config。');
    else if (m.required !== undefined && typeof m.required !== 'boolean') bad(`modules.${key}.required`, '应为布尔值。');
  }
  const config = (key: string) => {
    const m = modules[key];
    if (!record(m) || m.version !== '1') return undefined;
    if (!record(m.config)) { bad(`modules.${key}.config`, '应为对象。'); return undefined; }
    return m.config;
  };
  const generation = config(GENERATION);
  const taskList = generation && Array.isArray(generation.tasks) ? generation.tasks : [];
  const taskMap = new Map<string, Record<string, unknown>>();
  for (const t of taskList) if (record(t) && typeof t.id === 'string') taskMap.set(t.id, t);
  const parts = (v: unknown, p: string, allowOutput = true) => {
    if (!Array.isArray(v)) { bad(p, '内容应为有类型的数组。'); return; }
    v.forEach((part, i) => {
      const at = `${p}[${i}]`;
      if (!record(part)) { bad(at, '内容需要 type。'); return; }
      if (part.alt !== undefined && typeof part.alt !== 'string') bad(`${at}.alt`, '应为文字。');
      if (part.type === 'text') { if (typeof part.text !== 'string') bad(at, '文本需要 text。'); }
      else if (part.type === 'media') {
        if (!nonempty(part.uri) || !nonempty(part.mimeType)) bad(at, '媒体内容需要 uri 和 mimeType。');
        if (part.purpose !== undefined && typeof part.purpose !== 'string') bad(`${at}.purpose`, '应为文字。');
      }
      else if (part.type === 'resource') knownRef(part.ref, at);
      else if (part.type === 'output' && allowOutput) {
        const task = taskMap.get(String(part.task));
        if (!task || !Array.isArray(task.outputs) || !task.outputs.some(o => record(o) && o.id === part.output)) bad(at, '生成结果引用无法解析。');
      } else bad(at, '未支持的内容类型。');
    });
  };
  const role = (r: unknown, p: string) => { if (r !== undefined && (typeof r !== 'string' || !Object.hasOwn(roles, r))) bad(p, '找不到角色位置。'); };
  const conversation = config(CONVERSATION);
  if (conversation) {
    role(conversation.role, 'conversation.role');
    if (conversation.context !== undefined && typeof conversation.context !== 'string') bad('conversation.context', '应为文字。');
    if (conversation.opening !== undefined) parts(conversation.opening, 'conversation.opening');
    if (conversation.worlds !== undefined) {
      if (!stringArray(conversation.worlds)) bad('conversation.worlds', '应为资源引用数组。');
      else conversation.worlds.forEach(r => knownRef(r, 'conversation.worlds', 'lorebook'));
    }
  }
  const flow = config(FLOW);
  const nodes = flow && Array.isArray(flow.nodes) ? flow.nodes : [];
  const nodeIds = new Set(nodes.filter(record).map(n => n.id));
  const state = flow && record(flow.state) ? flow.state : {};
  const stateMap = (v: unknown, p: string, declared = true) => {
    if (!record(v)) { bad(p, '应为状态对象。'); return; }
    for (const [key, val] of Object.entries(v)) {
      if (!id(key) || !scalar(val) || (declared && (!Object.hasOwn(state, key) || typeof val !== typeof state[key]))) bad(`${p}.${key}`, '状态必须已声明，且值类型相符。');
    }
  };
  if (flow) {
    if (!Array.isArray(flow.nodes) || nodes.length === 0 || !nodeIds.has(flow.entry)) bad('flow.entry', '流程需要存在的入口节点。');
    if (flow.state !== undefined) stateMap(flow.state, 'flow.state', false);
    if (nodeIds.size !== nodes.length) bad('flow.nodes', '节点 ID 不能重复。');
    nodes.forEach((node, i) => {
      const p = `flow.nodes[${i}]`;
      if (!record(node) || !id(node.id)) { bad(p, '节点需要唯一 ID。'); return; }
      for (const key of ['title', 'context']) if (node[key] !== undefined && typeof node[key] !== 'string') bad(`${p}.${key}`, '应为文字。');
      for (const key of ['dialogue', 'end']) if (node[key] !== undefined && typeof node[key] !== 'boolean') bad(`${p}.${key}`, '应为布尔值。');
      role(node.role, `${p}.role`);
      if (node.content !== undefined) parts(node.content, `${p}.content`);
      if (node.choices !== undefined) {
        if (!Array.isArray(node.choices)) { bad(`${p}.choices`, '应为选项数组。'); return; }
        const choiceIds = new Set();
        for (const c of node.choices) {
          if (!record(c) || !id(c.id) || !nonempty(c.label) || !nodeIds.has(c.target) || choiceIds.has(c.id)) { bad(`${p}.choices`, '选项需要唯一 ID、文字和存在的目标。'); continue; }
          choiceIds.add(c.id);
          if (c.when !== undefined) stateMap(c.when, `${p}.choices.when`);
          if (c.set !== undefined) stateMap(c.set, `${p}.choices.set`);
          if (c.feedback !== undefined) parts(c.feedback, `${p}.choices.feedback`);
        }
        if (node.end && node.choices.length) bad(p, '结束节点不能同时声明前进选项。');
      }
    });
  }
  if (generation) {
    if (!Array.isArray(generation.tasks)) bad('generation.tasks', '应为任务数组。');
    if (taskMap.size !== taskList.length) bad('generation.tasks', '任务 ID 不能缺少或重复。');
    for (const [key, t] of taskMap) {
      const p = `generation.tasks.${key}`;
      if (!id(key) || !nonempty(t.label) || !nonempty(t.capability)) bad(p, '任务需要 ID、label 和 capability。');
      parts(t.inputs, `${p}.inputs`);
      if (!Array.isArray(t.outputs) || !t.outputs.length) bad(`${p}.outputs`, '需要至少一个有名称和类型的输出。');
      else {
        const outputIds = new Set();
        for (const output of t.outputs) {
          if (!record(output) || !id(output.id) || !nonempty(output.kind) || outputIds.has(output.id) || (!['text','image','music','speech','sound','video'].includes(output.kind) && !output.kind.startsWith('x-'))) bad(`${p}.outputs`, '输出需要唯一 ID 和支持的媒体类型。');
          else outputIds.add(output.id);
        }
      }
      if (!record(t.trigger) || typeof t.trigger.event !== 'string' || !['manual', 'enter'].includes(t.trigger.event)) bad(`${p}.trigger`, '触发方式需要字符串 manual 或 enter。');
      else if (t.trigger.node !== undefined && !nodeIds.has(t.trigger.node)) bad(`${p}.trigger.node`, '找不到触发节点。');
      if (typeof t.reuse !== 'string' || !['run', 'visit', 'never'].includes(t.reuse)) bad(`${p}.reuse`, '需要显式指定字符串 run、visit 或 never。');
      if (record(t.trigger) && t.trigger.event === 'enter' && t.reuse === 'never') bad(`${p}.reuse`, '自动触发任务需要 run 或 visit，避免重复执行。');
      if (t.required !== undefined && typeof t.required !== 'boolean') bad(`${p}.required`, '应为布尔值。');
      if (t.fallback !== undefined) parts(t.fallback, `${p}.fallback`, false);
      if (t.dependsOn !== undefined && (!stringArray(t.dependsOn) || t.dependsOn.some(x => !taskMap.has(x)))) bad(`${p}.dependsOn`, '任务依赖无法解析。');
      if (stringArray(t.dependsOn)) for (const dependencyId of t.dependsOn) {
        const dependency = taskMap.get(dependencyId);
        if (dependency && dependency.reuse !== 'run' && record(dependency.trigger) && dependency.trigger.node !== undefined && (!record(t.trigger) || t.trigger.node !== dependency.trigger.node)) {
          bad(`${p}.dependsOn`, `依赖 ${dependencyId} 的结果只属于它所在场景的本次进入。跨场景依赖需由作者将该任务设为 reuse: run，或把任务放在同一场景。`);
        }
      }
      if (Array.isArray(t.inputs)) for (const part of t.inputs) if (record(part) && part.type === 'output' && (!stringArray(t.dependsOn) || !t.dependsOn.includes(String(part.task)))) bad(`${p}.inputs`, '输出输入需要在 dependsOn 中显式声明依赖。');
    }
    const active = new Set<string>(); const done = new Set<string>();
    const visit = (key: string) => {
      if (active.has(key)) { bad('generation.tasks', '生成依赖不能形成循环。'); return; }
      if (done.has(key)) return;
      active.add(key);
      const t = taskMap.get(key);
      if (t && stringArray(t.dependsOn)) t.dependsOn.filter(x => taskMap.has(x)).forEach(visit);
      active.delete(key); done.add(key);
    };
    taskMap.forEach((_, key) => visit(key));
  }
  if (!issues.some(issue => issue.level === 'error')) issues.push(...impossibleRequiredDependencies(value as StorybookWork));
  return issues;
}

function impossibleRequiredDependencies(work: StorybookWork): ProtocolIssue[] {
  const flow = flowOf(work); if (!flow) return [];
  const nodes = new Map(flow.nodes.map(node => [node.id, node]));
  // Ignoring conditions over-approximates reachability: only definite failures
  // are rejected, not every route that could omit an optional prerequisite.
  const reachable = (blocked?: string) => {
    const seen = new Set<string>(); const pending = [flow.entry];
    while (pending.length) { const id = pending.pop()!; if (id === blocked || seen.has(id)) continue; seen.add(id); for (const choice of nodes.get(id)?.choices ?? []) pending.push(choice.target); }
    return seen;
  };
  const all = reachable(); const tasks = new Map(tasksOf(work).map(task => [task.id, task])); const issues: ProtocolIssue[] = [];
  for (const gate of tasks.values()) {
    if (!gate.required || hasUsableFallback(gate, work)) continue;
    const at = gate.trigger.node ?? flow.entry; if (!all.has(at)) continue;
    const before = reachable(at); const seen = new Set<string>();
    const inspect = (id: string) => {
      if (seen.has(id)) return; seen.add(id);
      const dependency = tasks.get(id); if (!dependency) return;
      const where = dependency.trigger.node;
      if (where && where !== at && !before.has(where)) {
        issues.push({ path: `generation.tasks.${gate.id}.dependsOn`, level: 'error', message: `必需任务 ${gate.label} 阻止离开 ${at}，但依赖 ${dependency.label} 只能在尚不可到达的 ${where} 执行。请把前置任务移到可先到达的场景，或明确提供替代内容。` });
        return;
      }
      if (!hasUsableFallback(dependency, work)) dependency.dependsOn?.forEach(inspect);
    };
    gate.dependsOn?.forEach(inspect);
  }
  return issues;
}

export function parseProtocolDocument(value: unknown): { document: ProtocolDocument; issues: ProtocolIssue[] } {
  let issues: ProtocolIssue[]; let document: ProtocolDocument;
  if (record(value) && value.spec === 'chara_card_v2') {
    issues = validateCard(value); document = { kind: 'card', data: value as CharacterCardV2 };
  } else if (record(value) && value.format === 'nimi.storybook') {
    issues = validateWork(value); document = { kind: 'work', data: value as StorybookWork };
  } else if (record(value) && Array.isArray(value.entries)) {
    issues = validateLorebook(value); document = { kind: 'lorebook', data: value as Lorebook };
  } else throw new Error('支持 Character Card V2、Storybook 作品和 lorebook JSON。');
  const errors = issues.filter(i => i.level === 'error');
  if (errors.length) throw new Error(errors.slice(0, 4).map(i => `${i.path}：${i.message}`).join('\n'));
  const normalized = structuredClone(document);
  if (normalized.kind === 'card') normalizeCard(normalized.data);
  else if (normalized.kind === 'lorebook') normalizeBook(normalized.data);
  else for (const resource of Object.values(normalized.data.resources ?? {})) {
    if (resource.type === 'character') normalizeCard(resource.card);
    else if (resource.type === 'lorebook') normalizeBook(resource.book);
  }
  return { document: normalized, issues };
}

function normalizeBook(book: Lorebook) { book.extensions ??= {}; book.entries.forEach(entry => { entry.extensions ??= {}; }); }
function normalizeCard(card: CharacterCardV2) { card.data.extensions ??= {}; if (card.data.character_book) normalizeBook(card.data.character_book); }

export function safeMediaUri(uri: unknown): string | undefined {
  if (typeof uri !== 'string') return undefined;
  if (/^storybook-media:[a-f0-9]{64}\.(png|jpg|webp|gif|mp3|ogg|wav|mp4|webm)$/.test(uri)) return uri;
  if (/^https:\/\/[^\s]+$/i.test(uri) || /^\.\/stories\/[a-z0-9-]+\.(jpg|png|webp|mp3|ogg|mp4|webm)$/.test(uri) || /^data:(image\/(png|jpeg|webp|gif)|audio\/(mpeg|ogg|wav)|video\/(mp4|webm));base64,[A-Za-z0-9+/=\r\n]+$/.test(uri)) return uri;
  return undefined;
}

export function resolvedTextInputSupport(parts: ContentPart[]): string | undefined {
  if (parts.some(part => part.type !== 'text')) return '当前生成通道尚不支持解析后的媒体或非文本输入。';
  if (!parts.some(part => part.type === 'text' && part.text.trim())) return '当前文本生成需要非空的输入内容。';
  return undefined;
}
export function taskSupport(task: GenerationTask, work: StorybookWork, resolved?: ContentPart[]): string | undefined {
  if (task.capability !== 'text.generate') {
    const labels: Record<string, string> = { 'image.generate': '图片生成', 'music.generate': '音乐生成', 'speech.generate': '语音生成', 'sound.generate': '音效生成', 'video.generate': '视频生成' };
    return `当前播放器尚不支持${labels[task.capability] ?? '这项生成能力'}。`;
  }
  if (task.outputs.length !== 1 || task.outputs[0].kind !== 'text') return '当前文本生成支持一个 text 输出。';
  if (resolved) return resolvedTextInputSupport(resolved);
  if (task.inputs.some(p => p.type === 'media')) return '当前生成通道尚不支持媒体输入。';
  if (task.inputs.some(p => p.type === 'resource' && work.resources?.[p.ref]?.type !== 'text')) return '当前生成通道尚不支持媒体输入。';
  if (task.inputs.some(p => p.type === 'output' && tasksOf(work).find(t => t.id === p.task)?.outputs.find(o => o.id === p.output)?.kind !== 'text')) return '当前生成通道尚不支持媒体结果作为输入。';
  if (!task.inputs.some(p => p.type === 'output')) return resolvedTextInputSupport(task.inputs.map(p => {
    if (p.type !== 'resource') return p;
    const resource = work.resources?.[p.ref];
    return resource?.type === 'text' ? { type: 'text', text: resource.text } : p;
  }));
  return undefined;
}

export function hasUsableFallback(task: GenerationTask, work: StorybookWork): boolean {
  return Boolean(task.fallback?.length && task.fallback.every(part => {
    if (part.type === 'text') return Boolean(part.text.trim());
    const resource = part.type === 'media' ? part : part.type === 'resource' ? work.resources?.[part.ref] : undefined;
    if (resource?.type === 'text') return Boolean(resource.text.trim());
    return resource?.type === 'media' && Boolean(safeMediaUri(resource.uri)) && /^(image\/(png|jpeg|webp|gif)|audio\/(mpeg|ogg|wav)|video\/(mp4|webm))$/.test(resource.mimeType);
  }));
}

// @nimi-authority: rule.storybook.protocol.r004
export function inspectWorkSupport(work: StorybookWork): SupportIssue[] {
  const issues: SupportIssue[] = [];
  const required = new Set<string>();
  const need = (task: GenerationTask) => {
    if (required.has(task.id) || hasUsableFallback(task, work)) return;
    required.add(task.id);
    for (const id of task.dependsOn ?? []) { const dependency = tasksOf(work).find(t => t.id === id); if (dependency) need(dependency); }
  };
  tasksOf(work).filter(t => t.required).forEach(need);
  for (const [key, m] of Object.entries(work.modules ?? {})) {
    if (![CONVERSATION, FLOW, GENERATION].includes(key) || m.version !== '1') issues.push({ id: key, message: `播放器不支持模块 ${key} v${m.version}，内容已保留。`, blocking: m.required === true });
  }
  for (const task of tasksOf(work)) {
    const unsupported = taskSupport(task, work);
    if (unsupported) issues.push({ id: task.id, message: `${task.label}：${unsupported}${hasUsableFallback(task, work) ? '触发后将使用作者提供的替代内容。' : '此任务暂不可执行。'}`, blocking: required.has(task.id) });
    if (task.fallback?.length && !hasUsableFallback(task, work)) issues.push({ id: `${task.id}.fallback`, message: `${task.label} 的替代内容包含当前无法显示的内容，不能代替必需结果。`, blocking: task.required === true });
  }
  const parts: ContentPart[] = [
    ...(conversationOf(work).opening ?? []),
    ...(flowOf(work)?.nodes.flatMap(n => [...(n.content ?? []), ...(n.choices ?? []).flatMap(c => c.feedback ?? [])]) ?? []),
  ];
  if (work.cover) parts.push({ type: 'resource', ref: work.cover });
  for (const [index, part] of parts.entries()) if (part.type === 'resource' || part.type === 'media') {
    const resource = part.type === 'media' ? part : work.resources?.[part.ref];
    const id = part.type === 'media' ? `inline-media-${index}` : part.ref;
    if (resource?.type === 'media' && (!safeMediaUri(resource.uri) || !/^(image\/(png|jpeg|webp|gif)|audio\/(mpeg|ogg|wav)|video\/(mp4|webm))$/.test(resource.mimeType))) issues.push({ id, message: `媒体 ${part.alt || id} 的格式或地址暂不支持，将显示文字说明。`, blocking: false });
    if (resource && !['media','text'].includes(resource.type)) issues.push({ id, message: `资源 ${id} 不能作为页面内容显示。`, blocking: true });
  }
  return issues;
}
