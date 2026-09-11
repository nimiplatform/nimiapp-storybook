import { mintId } from '../ids.js';
import {
  CONVERSATION, conversationOf, flowOf, tasksOf,
  type CharacterCardV2, type ContentPart, type ImportedDocument, type Lorebook,
  type StorybookWork, type StateValue, type GenerationTask,
} from './types.js';
import { hasUsableFallback, inspectWorkSupport, validateCard, validateLorebook, validateWork, record } from './validate.js';

export type BoundCard = { sourceRef: string; card: CharacterCardV2; artwork?: string; artworkMimeType?: string };
export type BoundWorld = { sourceRef: string; book: Lorebook };

// @nimi-authority: rule.storybook.protocol.r005
export type ExperienceTruthPackage = {
  kind: 'experience'; id: string; projectId: string; version: 1;
  work: StorybookWork; cards: Record<string, BoundCard>; worlds: BoundWorld[];
  sourceRefs: string[]; admittedAt: string;
};
export type ExperienceEvent = {
  id: string; kind: 'opening' | 'scene' | 'user' | 'assistant' | 'choice' | 'feedback';
  content: ContentPart[]; role?: string; nodeId?: string; at: string;
  visit: number;
  generationId?: string;
};
export type GenerationAttempt = {
  id: string; taskId: string; scope: string; capability: string;
  projectId: string;
  request: { kind: 'dialogue' | 'task'; eventId?: string; roleId?: string; nodeId?: string; visit: number };
  status: 'running' | 'succeeded' | 'failed' | 'unavailable' | 'cancelled';
  outputs: Record<string, ContentPart[]>; createdAt: string; completedAt?: string;
  inputRefs: string[]; message?: string; reason?: string;
  provenance?: { traceId: string; route: 'local' | 'cloud'; configHash: string };
  context?: { activatedLore: string[]; omittedTurns: number; estimatedLoreTokens: number };
};
export type ExperienceCheckpoint = {
  id: string; label: string; eventCount: number; attemptCount: number;
  nodeId?: string; visit: number; state: Record<string, StateValue>; roleId?: string;
};
export type ExperienceRun = {
  id: string; authority: ExperienceTruthPackage; playerName: string; roleId?: string;
  greetingIndex: number; nodeId?: string; visit: number; state: Record<string, StateValue>;
  events: ExperienceEvent[]; attempts: GenerationAttempt[]; checkpoints: ExperienceCheckpoint[];
  forkedFrom?: { runId: string; checkpointId: string };
  createdAt: string; updatedAt: string;
};

export function documentTitle(document: ImportedDocument): string {
  return document.kind === 'card' ? document.data.data.name || document.sourceName.replace(/\.[^.]+$/, '') || '未命名角色' : document.kind === 'work' ? document.data.title : document.data.name || document.sourceName.replace(/\.[^.]+$/, '');
}
export function embeddedWork(card: CharacterCardV2): { work?: StorybookWork; error?: string } {
  const value = card.data.extensions?.['nimi.storybook'];
  if (value === undefined) return {};
  const issues = validateWork(value).filter(i => i.level === 'error');
  return issues.length ? { error: issues.map(i => `${i.path}：${i.message}`).join('\n') } : { work: value as StorybookWork };
}
export function defaultWork(document: ImportedDocument): StorybookWork {
  if (document.kind === 'work') return structuredClone(document.data);
  return {
    format: 'nimi.storybook', version: '0.1.0', title: documentTitle(document),
    ...(document.kind === 'card' ? { roles: { companion: { label: '同行的人', required: true } } } : {}),
  };
}
export function cardArtwork(card: CharacterCardV2): string | undefined {
  return typeof card.data.avatar === 'string' ? card.data.avatar : undefined;
}
export function substitute(text: string, char: string, user: string, original?: string): string {
  return text.replace(/\{\{(char|user|original)\}\}|<(bot|user)>/gi, (match, token: string | undefined, alias: string | undefined) => {
    const key = (token ?? alias!).toLowerCase();
    return ({ char, bot: char, user, original })[key as 'char' | 'bot' | 'user' | 'original'] ?? match;
  });
}
export function activeNode(run: ExperienceRun) {
  return flowOf(run.authority.work)?.nodes.find(n => n.id === run.nodeId);
}
export function activeCard(run: ExperienceRun): CharacterCardV2 | undefined {
  return run.roleId ? run.authority.cards[run.roleId]?.card : undefined;
}
export function textParts(text: string): ContentPart[] { return text ? [{ type: 'text', text }] : []; }
export function eventText(event: ExperienceEvent): string { return event.content.filter(p => p.type === 'text').map(p => p.text).join('\n'); }
function append(run: ExperienceRun, event: Omit<ExperienceEvent, 'id' | 'at' | 'visit'>, now: string): ExperienceRun {
  return { ...run, events: [...run.events, { ...event, id: mintId('event'), at: now, visit: run.visit }], updatedAt: now };
}
function enter(run: ExperienceRun, nodeId: string, now: string): ExperienceRun {
  const node = flowOf(run.authority.work)?.nodes.find(n => n.id === nodeId);
  if (!node) throw new Error('找不到要进入的场景。');
  if (!node.end && node.dialogue === false && !(node.choices ?? []).some(c => Object.entries(c.when ?? {}).every(([key, value]) => run.state[key] === value))) throw new Error(`「${node.title || node.id}」没有可用的行动。请检查作品的条件设置。`);
  const next = { ...run, nodeId, visit: run.visit + 1, roleId: node.role ?? run.roleId, updatedAt: now };
  return append(next, { kind: 'scene', nodeId, content: node.content ?? [], role: next.roleId }, now);
}
export function createExperience(input: {
  work: StorybookWork; sourceRef: string; cards: Record<string, BoundCard>; worlds?: BoundWorld[];
  playerName: string; greetingIndex?: number; now: string;
}): ExperienceRun {
  const errors = validateWork(input.work).filter(i => i.level === 'error');
  if (errors.length) throw new Error(errors[0].message);
  const blocked = inspectWorkSupport(input.work).filter(i => i.blocking);
  if (blocked.length) throw new Error(blocked.map(i => i.message).join('\n'));
  if (!input.playerName.trim() || input.playerName.length > 80) throw new Error('请填写 80 字以内的游玩称呼。');
  if (!input.sourceRef.trim()) throw new Error('缺少作品的导入引用。');
  const worlds = input.worlds ?? (conversationOf(input.work).worlds ?? []).flatMap(ref => {
    const resource = input.work.resources?.[ref];
    return resource?.type === 'lorebook' ? [{ sourceRef: `${input.sourceRef}#resources/${ref}`, book: resource.book }] : [];
  });
  const cards = structuredClone(input.cards);
  for (const [roleId, role] of Object.entries(input.work.roles ?? {})) {
    if (!cards[roleId] && role.card) {
      const resource = input.work.resources?.[role.card];
      if (resource?.type === 'character') {
        const portrait = resource.portrait ? input.work.resources?.[resource.portrait] : undefined;
        cards[roleId] = { sourceRef: `${input.sourceRef}#resources/${role.card}`, card: resource.card, ...(portrait?.type === 'media' ? { artwork: portrait.uri, artworkMimeType: portrait.mimeType } : {}) };
      }
    }
    if (role.required && !cards[roleId]) throw new Error(`请为「${role.label}」选择角色。`);
  }
  for (const [key, bound] of Object.entries(cards)) {
    if (!Object.hasOwn(input.work.roles ?? {}, key) || !bound.sourceRef || validateCard(bound.card).some(i => i.level === 'error')) throw new Error('角色绑定无效。');
  }
  for (const bound of worlds) if (!bound.sourceRef || validateLorebook(bound.book).some(i => i.level === 'error')) throw new Error('世界资料绑定无效。');
  const projectId = mintId('experience');
  const authority: ExperienceTruthPackage = structuredClone({
    kind: 'experience', id: `truth:${projectId}:experience:definition`, projectId, version: 1,
    work: input.work, cards, worlds,
    sourceRefs: [...new Set([input.sourceRef, ...Object.values(cards).map(c => c.sourceRef), ...worlds.map(w => w.sourceRef)])],
    admittedAt: input.now,
  });
  const conversation = conversationOf(input.work);
  const roleId = conversation.role ?? Object.keys(cards)[0];
  const card = roleId ? cards[roleId]?.card : undefined;
  const greetings = card ? [card.data.first_mes, ...card.data.alternate_greetings] : [];
  const greetingIndex = input.greetingIndex ?? 0;
  if (!Number.isSafeInteger(greetingIndex) || greetingIndex < 0 || (greetings.length > 0 && greetingIndex >= greetings.length)) throw new Error('开场选择无效。');
  let run: ExperienceRun = {
    id: mintId('experience-run'), authority, playerName: input.playerName.trim(), roleId,
    greetingIndex, visit: 0, state: structuredClone(flowOf(input.work)?.state ?? {}),
    events: [], attempts: [], checkpoints: [], createdAt: input.now, updatedAt: input.now,
  };
  const flow = flowOf(input.work);
  if (flow) return enter(run, flow.entry, input.now);
  const opening = conversation.opening ?? textParts(greetings[greetingIndex] ?? '');
  if (opening.length) run = append(run, { kind: 'opening', content: opening, role: roleId }, input.now);
  return run;
}

export function checkpointExperience(run: ExperienceRun, label: string): ExperienceRun {
  return { ...run, checkpoints: [...run.checkpoints, {
    id: mintId('checkpoint'), label, eventCount: run.events.length, attemptCount: run.attempts.length,
    nodeId: run.nodeId, visit: run.visit, state: structuredClone(run.state), roleId: run.roleId,
  }] };
}
export function availableExperienceChoices(run: ExperienceRun) {
  return (activeNode(run)?.choices ?? []).filter(c => Object.entries(c.when ?? {}).every(([key, value]) => run.state[key] === value));
}
export function chooseExperience(run: ExperienceRun, choiceId: string, now: string): ExperienceRun {
  const choice = availableExperienceChoices(run).find(c => c.id === choiceId);
  if (!choice || run.attempts.some(a => a.status === 'running')) throw new Error('这个选择当前不可用。');
  if (requiredTasksPending(run).length) throw new Error('请先完成当前体验需要的生成任务。');
  let next = append(checkpointExperience(run, choice.label), { kind: 'choice', content: textParts(choice.label), nodeId: run.nodeId, role: run.roleId }, now);
  if (choice.feedback?.length) next = append(next, { kind: 'feedback', content: choice.feedback, nodeId: run.nodeId, role: run.roleId }, now);
  next = { ...next, state: { ...next.state, ...choice.set } };
  return enter(next, choice.target, now);
}
export function addPlayerMessage(run: ExperienceRun, text: string, now: string): ExperienceRun {
  if (!text.trim() || text.length > 6000) throw new Error('请输入 6000 字以内的内容。');
  if (activeNode(run)?.end || activeNode(run)?.dialogue === false || run.attempts.some(a => a.status === 'running')) throw new Error('当前场景暂不能对话。');
  if (requiredTasksPending(run).length) throw new Error('请先完成当前体验需要的生成任务。');
  return append(checkpointExperience(run, text.trim().slice(0, 36)), { kind: 'user', content: textParts(text.trim()), nodeId: run.nodeId }, now);
}
export function addCharacterMessage(run: ExperienceRun, text: string, now: string, generationId: string): ExperienceRun {
  return append(run, { kind: 'assistant', content: textParts(text), role: run.roleId, nodeId: run.nodeId, generationId }, now);
}
export function forkExperience(run: ExperienceRun, checkpointId: string, now: string): ExperienceRun {
  const index = run.checkpoints.findIndex(c => c.id === checkpointId);
  if (index < 0 || run.attempts.some(a => a.status === 'running')) throw new Error('暂时不能从这里重新开始。');
  const cp = run.checkpoints[index];
  return structuredClone({
    ...run, id: mintId('experience-run'), forkedFrom: { runId: run.id, checkpointId },
    roleId: cp.roleId, nodeId: cp.nodeId, visit: cp.visit, state: cp.state,
    events: run.events.slice(0, cp.eventCount), attempts: run.attempts.slice(0, cp.attemptCount),
    checkpoints: run.checkpoints.slice(0, index), createdAt: now, updatedAt: now,
  });
}
export function taskScope(run: ExperienceRun, task: GenerationTask): string {
  return task.reuse === 'run' ? 'run' : `visit:${run.visit}`;
}
export function latestTaskAttempt(run: ExperienceRun, task: GenerationTask): GenerationAttempt | undefined {
  return [...run.attempts].reverse().find(a => a.taskId === task.id && a.scope === taskScope(run, task));
}
export function requiredTasksPending(run: ExperienceRun): GenerationTask[] {
  return tasksOf(run.authority.work).filter(task => {
    if (!task.required || (task.trigger.node && task.trigger.node !== run.nodeId)) return false;
    const result = latestTaskAttempt(run, task);
    return !result || result.status === 'running' || (result.status !== 'succeeded' && !hasUsableFallback(task, run.authority.work));
  });
}
export function outputParts(run: ExperienceRun, taskId: string, outputId: string): ContentPart[] {
  const task = tasksOf(run.authority.work).find(t => t.id === taskId);
  if (!task) return [];
  const attempt = latestTaskAttempt(run, task);
  if (attempt?.status === 'succeeded') return attempt.outputs[outputId] ?? [];
  if (attempt && ['unavailable', 'failed', 'cancelled'].includes(attempt.status) && hasUsableFallback(task, run.authority.work)) return task.fallback ?? [];
  return [];
}
export function partsText(parts: ContentPart[], run: ExperienceRun): string {
  return parts.map(p => {
    if (p.type === 'text') return p.text;
    if (p.type === 'media') return p.alt ?? '';
    if (p.type === 'output') return partsText(outputParts(run, p.task, p.output), run);
    const resource = run.authority.work.resources?.[p.ref];
    return resource?.type === 'text' ? resource.text : p.alt ?? (resource?.type === 'media' ? resource.alt : '') ?? '';
  }).filter(Boolean).join('\n');
}
export function eventContentText(event: ExperienceEvent, run: ExperienceRun): string {
  return partsText(eventContentParts(event, run), run);
}

// @nimi-authority: rule.storybook.protocol.r002
export function resolveExperienceParts(run: ExperienceRun, parts: ContentPart[], options?: { roleId?: string; expand: boolean }): ContentPart[] {
  const roleId = options ? options.roleId : run.roleId;
  const char = roleId ? run.authority.cards[roleId]?.card.data.name ?? '叙述者' : '叙述者';
  const expand = (text: string) => options?.expand === false ? text : substitute(text, char, run.playerName);
  return parts.flatMap(part => {
    if (part.type === 'text') return [{ ...part, text: expand(part.text) }];
    if (part.type === 'media') return [{ ...part, ...(part.alt ? { alt: expand(part.alt) } : {}) }];
    if (part.type === 'resource') {
      const resource = run.authority.work.resources?.[part.ref];
      if (resource?.type === 'text') return [{ type: 'text' as const, text: expand(resource.text) }];
      if (resource?.type === 'media') return [{ ...resource, alt: expand(part.alt ?? resource.alt ?? '') }];
      return [part];
    }
    const task = tasksOf(run.authority.work).find(task => task.id === part.task);
    const generated = task && latestTaskAttempt(run, task)?.status === 'succeeded';
    return resolveExperienceParts(run, outputParts(run, part.task, part.output), { roleId, expand: !generated });
  });
}
export function eventContentParts(event: ExperienceEvent, run: ExperienceRun): ContentPart[] {
  return resolveExperienceParts({ ...run, visit: event.visit }, event.content, { roleId: event.role, expand: event.kind !== 'user' && event.kind !== 'assistant' });
}

export function workWithWorlds(work: StorybookWork, books: Lorebook[]): StorybookWork {
  const next = structuredClone(work); const refs: string[] = [];
  next.resources ??= {};
  for (const book of books) {
    const existing = Object.entries(next.resources).find(([, resource]) => resource.type === 'lorebook' && JSON.stringify(resource.book) === JSON.stringify(book));
    let ref = existing?.[0];
    if (!ref) {
      let index = 1; while (Object.hasOwn(next.resources, `world-${index}`)) index++;
      ref = `world-${index}`; next.resources[ref] = { type: 'lorebook', book: structuredClone(book) };
    }
    if (!refs.includes(ref)) refs.push(ref);
  }
  next.modules = { ...next.modules, [CONVERSATION]: { ...next.modules?.[CONVERSATION], version: '1', config: { ...conversationOf(next), worlds: refs } } };
  return next;
}
export function workWithCard(work: StorybookWork, roleId: string, card: CharacterCardV2, artwork?: { uri: string; mimeType: string }): StorybookWork {
  if (!Object.hasOwn(work.roles ?? {}, roleId)) throw new Error('找不到角色位置。');
  const next = structuredClone(work);
  const unique = (prefix: string) => {
    let candidate = `${prefix}-${roleId.slice(0, 80)}`; let index = 2;
    while (Object.hasOwn(next.resources ?? {}, candidate)) candidate = `${prefix}-${roleId.slice(0, 80)}-${index++}`;
    return candidate;
  };
  const ref = unique('card'); const portrait = artwork ? unique('portrait') : undefined;
  return { ...next, resources: {
    ...next.resources,
    ...(artwork && portrait ? { [portrait]: { type: 'media' as const, uri: artwork.uri, mimeType: artwork.mimeType, purpose: 'portrait' } } : {}),
    [ref]: { type: 'character', card: structuredClone(card), ...(portrait ? { portrait } : {}) },
  }, roles: { ...next.roles, [roleId]: { ...next.roles![roleId], card: ref } } };
}
export function workFromIdea(title: string, context: string): StorybookWork {
  return { format: 'nimi.storybook', version: '0.1.0', title, roles: { companion: { label: '同行的人' } }, modules: { [CONVERSATION]: { version: '1', config: { context } } } };
}
export function externalExtensionNames(card: CharacterCardV2): string[] {
  const ext = card.data.extensions;
  return record(ext) ? Object.keys(ext).filter(k => k !== 'nimi.storybook') : [];
}
