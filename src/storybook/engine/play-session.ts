import {
  applyChoice,
  appendTranscriptEntry,
  type PlayableChapter,
  type Choice,
  type StoryRun,
  type RunTranscript,
} from './run.js';
import { generateChoicesForNode } from './choices.js';
import { mintId } from './ids.js';
import type { NarrativeRunEnvelope } from './narrative.js';
import type { PromotionCandidate } from './promotion.js';
import type { GenerationRun } from './generation-record.js';

export type RunRecord = {
  packageId: string;
  run: StoryRun;
  transcript: RunTranscript;
  /** App-local guarded narrative spine + turn records for this run (wave-8). */
  narrative?: NarrativeRunEnvelope;
  /** Promotion candidates derived from real guarded turns in this run (wave-11). */
  promotionCandidates?: PromotionCandidate[];
  /** Candidate ids already resolved by Studio review (so they don't reappear). */
  resolvedCandidateIds?: string[];
  /** Exact pre-choice history for replay; the parent run is retained. */
  checkpoints?: {
    id: string;
    label: string;
    run: StoryRun;
    transcript: RunTranscript;
    narrative?: NarrativeRunEnvelope;
    promotionCandidates?: PromotionCandidate[];
    generationRuns?: GenerationRun[];
  }[];
  forkedFrom?: { runId: string; nodeId: string };
  generationRuns?: GenerationRun[];
};

// @nimi-authority: rule.storybook.product.r002
export function advanceStory(
  record: RunRecord,
  chapter: PlayableChapter,
  choice: Choice,
  now: string,
): RunRecord {
  const node = chapter.nodes.find((n) => n.id === record.run.currentNodeId);
  if (
    !node ||
    !generateChoicesForNode(chapter, node).some(
      (c) =>
        c.targetNodeId === choice.targetNodeId &&
        (node.choices.length ? c.id === choice.id : c.label === choice.label),
    )
  )
    throw new Error('这个选择已经不在当前场景中，请重新打开故事。');
  const advanced = applyChoice(record.run, chapter, choice, now);
  if (!advanced.ok) throw new Error(advanced.message);
  const checkpoint = structuredClone({
    id: mintId('checkpoint'),
    label: choice.label,
    run: record.run,
    transcript: record.transcript,
    narrative: record.narrative,
    promotionCandidates: record.promotionCandidates,
    generationRuns: record.generationRuns,
  });
  let transcript = appendTranscriptEntry(record.transcript, {
    at: now,
    kind: 'choice',
    detail: choice.label,
    choiceId: choice.id,
    nodeId: node.id,
  });
  const target = chapter.nodes.find((n) => n.id === advanced.value.currentNodeId);
  transcript = appendTranscriptEntry(transcript, {
    at: now,
    kind: 'enter-node',
    detail: target?.title || chapter.title,
    nodeId: advanced.value.currentNodeId,
  });
  return {
    ...record,
    run: advanced.value,
    transcript,
    checkpoints: [...(record.checkpoints ?? []), checkpoint],
  };
}

function rebindNarrative(
  narrative: NarrativeRunEnvelope | undefined,
  runId: string,
): NarrativeRunEnvelope | undefined {
  if (!narrative) return undefined;
  return {
    ...structuredClone(narrative),
    runId,
    spine: { ...structuredClone(narrative.spine), runId },
    turnRecords: narrative.turnRecords.map((r) => ({
      ...structuredClone(r),
      request: { ...r.request, runId },
      context: { ...structuredClone(r.context), runId },
    })),
  };
}

// @nimi-authority: rule.storybook.data-model.r008
export function forkStory(record: RunRecord, checkpointId: string, now: string): RunRecord {
  const index = record.checkpoints?.findIndex((c) => c.id === checkpointId) ?? -1;
  const point = record.checkpoints?.[index];
  if (!point) throw new Error('找不到这个岔路，原来的故事仍然保留。');
  const runId = mintId('run');
  return {
    packageId: record.packageId,
    run: { ...structuredClone(point.run), id: runId, startedAt: now, updatedAt: now },
    transcript: { ...structuredClone(point.transcript), runId },
    narrative: rebindNarrative(point.narrative, runId),
    generationRuns: structuredClone(point.generationRuns ?? []),
    checkpoints: record.checkpoints!.slice(0, index).map((p) => ({
      ...structuredClone(p),
      run: { ...structuredClone(p.run), id: runId },
      transcript: { ...structuredClone(p.transcript), runId },
      narrative: rebindNarrative(p.narrative, runId),
      promotionCandidates: [],
    })),
    promotionCandidates: [],
    forkedFrom: { runId: record.run.id, nodeId: point.run.currentNodeId },
  };
}
