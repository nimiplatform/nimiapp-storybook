import { makeTruthRef, mintId } from './ids.js';
import { fail, ok, type Result } from './failure.js';
import { bumpVersion, validateTruthPackage, type StorybookTruthPackage } from './truth.js';
import { type StoryNode, type Effect } from './run.js';
import { type StateVariable } from './foundation.js';

export type FoundationDraft = {
  title: string;
  premise: string;
  world: string;
  playerRole: string;
  tension: string;
  style: string;
  themes: string[];
  cast: {
    name: string;
    voice: string;
    publicFacts: string[];
    privateFacts: string[];
    goals: string[];
  }[];
  endingDirection: string;
};

export type ChapterDraft = {
  title: string;
  startNodeId: string;
  variables: StateVariable[];
  nodes: Omit<StoryNode, 'chapterId'>[];
  endings: { id: string; label: string }[];
};

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonempty(value: unknown, max = 2400): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function strings(value: unknown, max = 12): value is string[] {
  return Array.isArray(value) && value.length <= max && value.every((v) => nonempty(v));
}

function parseJson(text: string): unknown {
  return JSON.parse(
    text
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, ''),
  );
}

// @nimi-authority: rule.storybook.ia.r007
export function parseFoundationDraft(text: string): Result<FoundationDraft> {
  let value: unknown;
  try {
    value = parseJson(text);
  } catch {
    return fail('ai_generation_failed', 'AI 的改编方案没有完整生成。请重新生成。');
  }
  if (
    !object(value) ||
    !['title', 'premise', 'world', 'playerRole', 'tension', 'style', 'endingDirection'].every(
      (key) => nonempty(value[key]),
    ) ||
    !strings(value.themes, 4)
  ) {
    return fail('ai_generation_failed', '改编方案缺少故事前提、玩家身份或戏剧冲突。请重试。');
  }
  if (
    !Array.isArray(value.cast) ||
    value.cast.length < 1 ||
    value.cast.length > 5 ||
    !value.cast.every(
      (c) =>
        object(c) &&
        nonempty(c.name, 80) &&
        nonempty(c.voice) &&
        strings(c.publicFacts) &&
        strings(c.privateFacts) &&
        strings(c.goals),
    )
  ) {
    return fail('ai_generation_failed', 'AI 没有生成完整的人物阵容。请重新生成。');
  }
  return ok(value as FoundationDraft);
}

export function admitFoundation(
  pkg: StorybookTruthPackage,
  draft: FoundationDraft,
  generationId: string,
  now: string,
): Result<StorybookTruthPackage> {
  const checked = parseFoundationDraft(JSON.stringify(draft));
  if (!checked.ok) return checked;
  if (pkg.chapters.length)
    return fail('edit_conflict', '故事已有章节，请在编辑器中调整，避免覆盖已写好的故事。');
  const ref = (family: Parameters<typeof makeTruthRef>[1], id: string) =>
    makeTruthRef(pkg.projectId, family, id);
  const sceneRef = pkg.scenarioFrame?.ref ?? ref('scenario-frame', 'frame');
  const bibleRef = pkg.bible?.ref ?? ref('storybook-bible', 'bible');
  const castRef = pkg.sourceCast?.ref ?? ref('source-cast', 'cast');
  const briefRef = ref('adaptation-brief', 'brief');
  const next = bumpVersion(
    {
      ...pkg,
      scenarioFrame: {
        ref: sceneRef,
        background: draft.world,
        playerPosition: draft.playerRole,
        roles: draft.cast.map((c, i) => ({
          id: `role-${i}`,
          name: c.name,
          summary: c.publicFacts.join('；'),
        })),
        rules: pkg.scenarioFrame?.rules ?? [],
        contentBoundaries: pkg.scenarioFrame?.contentBoundaries ?? ['遵循原文的题材与分级'],
      },
      sourceCast: {
        ref: castRef,
        sources: draft.cast.map((c, i) => ({
          ...c,
          id: `source-${i}`,
          ref: ref('source-profile', `source-${i}`),
          allowedActions: ['对话', '行动'],
          provenance: 'creator' as const,
        })),
      },
      bible: {
        ref: bibleRef,
        premise: draft.premise,
        worldSummary: draft.world,
        styleFingerprint: draft.style,
        rhythmProfile: '短场景推进，每个关键选择都引出不同的代价。',
        themes: draft.themes,
        approved: false,
      },
      adaptationBrief: {
        ref: briefRef,
        title: draft.title,
        premiseSummary: draft.premise,
        playerPerspective: draft.playerRole,
        coreTension: draft.tension,
        targetMilestone: '一个有完整弧线、可重玩的故事',
        stylePlan: draft.style,
        pacingPlan: '短场景、具体抉择、不同结局',
        endingDirection: draft.endingDirection,
        approval: 'pending',
      },
      governance: { ...pkg.governance, lifecycle: 'draft', reviewState: 'open' },
      evidence: [
        ...pkg.evidence,
        ...[sceneRef, bibleRef, castRef, briefRef].map((truthRef) => ({
          id: mintId('evid'),
          truthRef,
          kind: 'execution' as const,
          sourceRef: generationId,
          note: '源文本的 AI 改编提案，待创作者批准。',
        })),
      ],
    },
    now,
  );
  const report = validateTruthPackage(next);
  return report.valid
    ? ok(next)
    : fail('ai_generation_failed', report.findings.map((f) => f.message).join('；'));
}

// A generated graph must be complete: every scene is reachable and every path
// terminates. Reject malformed output instead of repairing it with invented prose.
export function parseChapterDraft(text: string): Result<ChapterDraft> {
  let value: unknown;
  try {
    value = parseJson(text);
  } catch {
    return fail('ai_generation_failed', '章节没有完整生成。已保留故事设定，请重试。');
  }
  const invalid = (message: string) => fail('chapter_graph_unreachable', message);
  if (
    !object(value) ||
    !nonempty(value.title) ||
    !nonempty(value.startNodeId) ||
    !Array.isArray(value.nodes) ||
    value.nodes.length < 5 ||
    value.nodes.length > 24 ||
    !Array.isArray(value.endings) ||
    value.endings.length < 2 ||
    !Array.isArray(value.variables)
  )
    return invalid('章节需要完整场景和至少两个不同的结局。');
  if (
    !value.variables.every(
      (v) =>
        object(v) &&
        nonempty(v.id, 80) &&
        nonempty(v.label, 80) &&
        typeof v.initial === 'number' &&
        Number.isFinite(v.initial),
    )
  )
    return invalid('故事状态定义不完整。');
  if (new Set(value.variables.map((v) => v.id)).size !== value.variables.length)
    return invalid('故事状态名称重复。');
  if (!value.endings.every((e) => object(e) && nonempty(e.id, 80) && nonempty(e.label, 100)))
    return invalid('结局缺少名称。');
  const endingIds = new Set(value.endings.map((e) => e.id));
  if (endingIds.size !== value.endings.length) return invalid('结局标识重复。');
  const variables = new Set(value.variables.map((v) => v.id));
  const validEffects = (effects: unknown) =>
    effects === undefined ||
    (Array.isArray(effects) &&
      effects.every(
        (e) =>
          object(e) &&
          e.op === 'add-var' &&
          variables.has(e.target) &&
          typeof e.value === 'number' &&
          Number.isFinite(e.value),
      ));
  const nodes: Omit<StoryNode, 'chapterId'>[] = [];
  for (const n of value.nodes) {
    if (
      !object(n) ||
      !nonempty(n.id, 80) ||
      !nonempty(n.text, 3000) ||
      !Array.isArray(n.choices) ||
      !validEffects(n.effects)
    )
      return invalid('AI 返回了缺少正文或选项的场景。');
    if (n.title !== undefined && !nonempty(n.title, 100)) return invalid('场景标题无效。');
    if (n.speaker !== undefined && !nonempty(n.speaker, 80)) return invalid('场景角色无效。');
    if (n.isEnding !== undefined && typeof n.isEnding !== 'boolean')
      return invalid('场景结局标记无效。');
    if (
      n.isEnding
        ? !endingIds.has(n.endingId) || n.choices.length > 0
        : n.choices.length < 1 || n.choices.length > 4
    )
      return invalid('每个场景都需要可推进的选择，结局需要闭合。');
    const choices = [];
    for (const c of n.choices) {
      if (
        !object(c) ||
        !nonempty(c.id, 80) ||
        !nonempty(c.label, 140) ||
        !nonempty(c.targetNodeId, 80) ||
        !validEffects(c.effects)
      )
        return invalid('AI 返回了无效的选择或状态变化。');
      choices.push({
        id: c.id,
        label: c.label,
        targetNodeId: c.targetNodeId,
        effects: c.effects as Effect[] | undefined,
        source: 'authored' as const,
      });
    }
    if (new Set(choices.map((c) => c.id)).size !== choices.length)
      return invalid('同一场景的选项标识重复。');
    nodes.push({
      id: n.id,
      title: n.title as string | undefined,
      speaker: n.speaker as string | undefined,
      text: n.text,
      choices,
      effects: n.effects as Effect[] | undefined,
      isEnding: n.isEnding === true,
      endingId: n.endingId as string | undefined,
    });
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (byId.size !== nodes.length || !byId.has(value.startNodeId))
    return invalid('场景标识重复或缺少开场。');
  const visited = new Set<string>();
  const visiting = new Set<string>();
  function visit(id: string): boolean {
    if (visiting.has(id)) return false;
    if (visited.has(id)) return true;
    const n = byId.get(id);
    if (!n) return false;
    visiting.add(id);
    if (!n.choices.every((c) => visit(c.targetNodeId!))) return false;
    visiting.delete(id);
    visited.add(id);
    return true;
  }
  if (!visit(value.startNodeId) || visited.size !== nodes.length)
    return invalid('有分支无法到达，或选择会陷入循环。请重新生成章节。');
  if ([...endingIds].some((id) => !nodes.some((n) => n.isEnding && n.endingId === id)))
    return invalid('有结局缺少可抵达的场景。');
  return ok({
    title: value.title,
    startNodeId: value.startNodeId,
    variables: value.variables as StateVariable[],
    nodes,
    endings: value.endings as ChapterDraft['endings'],
  });
}

// @nimi-authority: rule.storybook.product.r004
export function admitChapter(
  pkg: StorybookTruthPackage,
  draft: ChapterDraft,
  generationId: string,
  now: string,
  options?: { replace: boolean },
): Result<StorybookTruthPackage> {
  if (!pkg.bible?.approved || pkg.adaptationBrief?.approval !== 'approved')
    return fail('adaptation_unconfirmed', '请先确认故事设定与改编方向。');
  if (pkg.chapters.length && !options?.replace)
    return fail('edit_conflict', '已有章节不会被自动覆盖。');
  if (options?.replace && pkg.chapters.length !== 1)
    return fail('edit_conflict', '整体修订目前只用于单章短篇，多章作品请使用高级编辑。');
  const checked = parseChapterDraft(JSON.stringify(draft));
  if (!checked.ok) return checked;
  const chapterId = options?.replace ? pkg.chapters[0]!.id : mintId('chapter');
  const chapterRef = makeTruthRef(pkg.projectId, 'chapter', chapterId);
  const topologyRef = makeTruthRef(pkg.projectId, 'branch-topology', 'topo');
  const matrixRef = makeTruthRef(pkg.projectId, 'state-ending-matrix', 'matrix');
  const next = bumpVersion(
    {
      ...pkg,
      chapters: [
        {
          ref: chapterRef,
          id: chapterId,
          title: draft.title,
          startNodeId: draft.startNodeId,
          nodes: draft.nodes.map((node) => ({ ...node, chapterId })),
        },
      ],
      branchTopology: {
        ref: topologyRef,
        startChapterId: chapterId,
        chapterIds: [chapterId],
        routes: [],
        switchPoints: draft.nodes.filter((n) => n.choices.length > 1).map((n) => n.id),
      },
      stateEndingMatrix: {
        ref: matrixRef,
        variables: draft.variables,
        flags: [],
        achievements: [],
        endings: draft.endings.map((e) => ({ ...e, reachableFromChapterId: chapterId })),
      },
      governance: { ...pkg.governance, lifecycle: 'play-ready' },
      evidence: [
        ...pkg.evidence,
        ...[chapterRef, topologyRef, matrixRef].map((truthRef) => ({
          id: mintId('evid'),
          truthRef,
          kind: 'execution' as const,
          sourceRef: generationId,
          note: '由已批准的故事设定生成并通过完整分支校验。',
        })),
      ],
      derivations: [
        ...pkg.derivations,
        {
          id: mintId('deriv'),
          kind: 'adaptation',
          fromRefs: [pkg.bible.ref, pkg.adaptationBrief.ref],
          toRef: chapterRef,
          note: '已批准的改编方向派生完整章节。',
        },
      ],
    },
    now,
  );
  const report = validateTruthPackage(next);
  return report.valid
    ? ok(next)
    : fail('ai_generation_failed', report.findings.map((f) => f.message).join('；'));
}
