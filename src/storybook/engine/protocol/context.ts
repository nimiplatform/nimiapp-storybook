import type { Lorebook, LoreEntry, ContentPart } from './types.js';
import { conversationOf, flowOf } from './types.js';
import { activeCard, activeNode, eventText, eventContentText, partsText, resolveExperienceParts, substitute, type ExperienceRun } from './session.js';
import { resolvedTextInputSupport } from './validate.js';

const DEFAULT_SYSTEM = '参与这场互动体验。依据给定角色和设定自然回应，让人物有自己的意图，为对方留下回应空间。不要替玩家决定行动或编造玩家台词。使用玩家当前使用的语言；尚无玩家输入时沿用开场语言。';
export const DEFAULT_POST_HISTORY = '';
export type PromptMessage = { role: 'system' | 'user'; text: string };
export type ContextTrace = { activatedLore: string[]; omittedTurns: number; estimatedLoreTokens: number };
export function estimateTokens(text: string): number {
  let ascii = 0; let other = 0;
  for (const ch of text) { if (ch.codePointAt(0)! < 128) ascii++; else other++; }
  return Math.ceil(ascii / 4) + other;
}
const byteLength = (s: string) => new TextEncoder().encode(s).byteLength;

// @nimi-authority: rule.storybook.protocol.r002
export function activateLore(input: {
  books: { ref: string; book: Lorebook }[]; history: string[]; char: string; user: string;
}): { before: string[]; after: string[]; refs: string[]; tokens: number } {
  const before: string[] = []; const after: string[] = []; const refs: string[] = [];
  const seenContent = new Set<string>(); let totalTokens = 0;
  for (const { ref, book } of input.books) {
    const depth = book.scan_depth ?? 4;
    let corpus = (depth === 0 ? [] : input.history.slice(-depth)).join('\n');
    const budget = Math.min(book.token_budget ?? 1024, 8192);
    const selected = new Set<number>(); let used = 0;
    const accepted: { entry: LoreEntry; index: number; content: string }[] = [];
    const entries = book.entries.map((entry, index) => ({ entry, index })).sort((a, b) => (b.entry.priority ?? 0) - (a.entry.priority ?? 0) || a.entry.insertion_order - b.entry.insertion_order || a.index - b.index);
    for (let pass = 0; pass <= entries.length; pass++) {
      let added = false;
      for (const { entry, index } of entries) {
        if (!entry.enabled || selected.has(index)) continue;
        const haystack = entry.case_sensitive ? corpus : corpus.toLocaleLowerCase();
        const matches = (keys: string[]) => keys.some(key => {
          const expanded = substitute(key, input.char, input.user);
          return expanded.length > 0 && haystack.includes(entry.case_sensitive ? expanded : expanded.toLocaleLowerCase());
        });
        if (!entry.constant && (!matches(entry.keys) || (entry.selective && !matches(entry.secondary_keys ?? [])))) continue;
        const content = substitute(entry.content, input.char, input.user);
        const tokens = estimateTokens(content);
        if (used + tokens > budget || seenContent.has(content)) continue;
        used += tokens; selected.add(index); seenContent.add(content); accepted.push({ entry, index, content }); added = true;
      }
      if (!book.recursive_scanning || !added) break;
      corpus += '\n' + accepted.map(x => x.content).join('\n');
    }
    accepted.sort((a, b) => a.entry.insertion_order - b.entry.insertion_order || a.index - b.index);
    for (const a of accepted) {
      (a.entry.position === 'before_char' ? before : after).push(a.content);
      refs.push(`${ref}/entries/${a.index}`);
    }
    totalTokens += used;
  }
  return { before, after, refs, tokens: totalTokens };
}

export function buildExperienceContext(run: ExperienceRun, taskInputs?: ContentPart[]): { messages: PromptMessage[]; trace: ContextTrace } {
  const card = activeCard(run); const work = run.authority.work; const node = activeNode(run);
  const char = card?.data.name ?? '叙述者'; const expand = (s: string, original?: string) => substitute(s, char, run.playerName, original);
  const bookInputs = [
    ...(card?.data.character_book ? [{ ref: `${run.authority.cards[run.roleId!].sourceRef}#character_book`, book: card.data.character_book }] : []),
    ...run.authority.worlds.map(w => ({ ref: w.sourceRef, book: w.book })),
  ];
  const lore = activateLore({ books: bookInputs, history: run.events.map(e => eventContentText(e, run)), char, user: run.playerName });
  const system = card?.data.system_prompt.trim() ? expand(card.data.system_prompt, DEFAULT_SYSTEM) : DEFAULT_SYSTEM;
  const characterDefinition = card ? [card.data.description, card.data.personality, card.data.scenario].filter(s => s.trim()).map(s => expand(s)).join('\n\n') : '';
  const otherCharacters = Object.entries(run.authority.cards).filter(([key]) => key !== run.roleId).map(([, bound]) => `${bound.card.data.name}\n${substitute([bound.card.data.description, bound.card.data.personality, bound.card.data.scenario].filter(Boolean).join('\n'), bound.card.data.name, run.playerName)}`);
  const workContext = [conversationOf(work).context, node?.context].filter((s): s is string => typeof s === 'string' && Boolean(s.trim())).map(s => expand(s));
  const scene = [...run.events].reverse().find(event => event.kind === 'scene' && event.nodeId === run.nodeId && event.visit === run.visit);
  const sceneText = scene ? eventContentText(scene, run) : partsText(resolveExperienceParts(run, node?.content ?? []), run);
  const sections = [
    system, ...lore.before, characterDefinition, ...lore.after,
    ...(otherCharacters.length ? [`Other participants:\n${otherCharacters.join('\n\n')}`] : []),
    ...(card?.data.mes_example.trim() ? [`Dialogue examples:\n${expand(card.data.mes_example)}`] : []),
    ...workContext,
    ...(flowOf(work) ? [`Current authored scene:\n${node?.title ?? run.nodeId}\n${sceneText}\nCurrent state: ${JSON.stringify(run.state)}\nStay within this scene. Only the player's authored choices change the scene or declared state.`] : []),
  ].filter(s => s.trim());
  const combined = sections.join('\n\n').trim();
  // Protected App Access currently accepts system/user messages only. History
  // keeps explicit author labels inside JSON, never invents an assistant SDK role.
  const chunks: string[] = []; let chunk = ''; let chunkBytes = 0;
  for (const ch of combined) {
    const size = byteLength(ch);
    if (chunkBytes + size > 30 * 1024) { chunks.push(chunk); chunk = ''; chunkBytes = 0; }
    chunk += ch; chunkBytes += size;
  }
  if (chunk.trim()) chunks.push(chunk);
  if (chunks.length > 4 || byteLength(combined) > 46 * 1024) throw new Error('角色和世界设定超过当前推理上下文容量。请减少叠加资料；原卡仍完整保留。');
  const messages: PromptMessage[] = chunks.map(text => ({ role: 'system', text: text.trim() }));
  const latestIsUser = run.events.at(-1)?.kind === 'user';
  const resolved = taskInputs ? resolveExperienceParts(run, taskInputs) : undefined;
  if (resolved) { const unsupported = resolvedTextInputSupport(resolved); if (unsupported) throw new Error(unsupported); }
  const latestInput = resolved ? partsText(resolved, run) : latestIsUser ? eventText(run.events.at(-1)!) : '';
  if (!latestInput.trim()) throw new Error('没有可发送的文本输入。');
  const history = run.events.slice(0, !taskInputs && latestIsUser ? -1 : undefined).map(e => ({
    speaker: e.kind === 'user' || e.kind === 'choice' ? run.playerName : e.role ? run.authority.cards[e.role]?.card.data.name ?? '叙述者' : '叙述者',
    kind: e.kind, content: eventContentText(e, run),
  })).filter(e => e.content);
  const post = card?.data.post_history_instructions.trim() ? expand(card.data.post_history_instructions, DEFAULT_POST_HISTORY).trim() : DEFAULT_POST_HISTORY;
  const historyBudget = Math.min(24 * 1024, 62 * 1024 - byteLength(combined) - byteLength(post) - byteLength(latestInput));
  let kept = history.slice();
  while (kept.length && byteLength(JSON.stringify(kept)) > historyBudget) kept = kept.slice(1);
  if (kept.length) messages.push({ role: 'user', text: `Previous events (speaker labels are part of the record):\n${JSON.stringify(kept)}` });
  messages.push({ role: 'user', text: latestInput.trim() });
  if (post) messages.push({ role: 'system', text: post });
  if (messages.length > 8 || messages.some(m => byteLength(m.text) > 32 * 1024) || messages.reduce((sum, m) => sum + byteLength(m.text) + byteLength(m.role), 0) > 64 * 1024) throw new Error('本次输入超过推理通道的上下文容量，请缩短输入或调整作品资料。');
  return { messages, trace: { activatedLore: lore.refs, omittedTurns: history.length - kept.length, estimatedLoreTokens: lore.tokens } };
}
