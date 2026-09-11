import { projectEditor } from '../store/content-editors.js';
import type { StoredProjectRecord } from '../store/storybook-store.js';
import { admitFoundation, approveBible, admitChapter } from '../engine/index.js';
import type { GenerationRun } from '../engine/generation-record.js';
import { runStoryFoundation, runStoryChapter, runChapterRevision } from './storybook-composer.js';

const now = () => new Date().toISOString();
function required(value: StoredProjectRecord | null): StoredProjectRecord { if (!value) throw new Error('找不到故事。'); return value; }
function withRuns(current: StoredProjectRecord, runs: GenerationRun[]): StoredProjectRecord {
  return { ...current, generationRuns: [...(current.generationRuns ?? []).filter(r => !runs.some(next => next.id === r.id)), ...runs] };
}

// @nimi-authority: rule.storybook.protocol.r007
// @nimi-authority: rule.storybook.ia.r007
export function generateProjectFoundation(projectId: string): Promise<void> {
  const editor = projectEditor(projectId);
  return editor.run('foundation', async () => {
    await editor.flush();
    const current = required(editor.getSnapshot().value);
    if (current.truthPackage.chapters.length) throw new Error('已有章节请使用修订入口。');
    const outcome = await runStoryFoundation({ projectId,
      source: current.sourceDraft?.text || current.truthPackage.scenarioFrame?.background || current.truthPackage.bible?.premise || '',
      direction: current.sourceDraft?.direction || '忠于原文',
      preferences: current.memory.feedbackPatches.filter(p => p.kind === 'preference').map(p => p.note),
    });
    const run: GenerationRun = outcome.ok ? { ...outcome.run, result: { kind: 'story-foundation', value: outcome.value } } : outcome.run;
    await editor.update(value => {
      const latest = required(value); const next = withRuns(latest, [run]);
      if (!outcome.ok) { editor.setNotice(outcome.message); return next; }
      if (latest.truthPackage.version !== current.truthPackage.version || JSON.stringify(latest.foundationDraft) !== JSON.stringify(current.foundationDraft)) {
        editor.setNotice('生成期间提案已有修改。新方案保留在创作记录中，你的编辑没有被覆盖。');
        return next;
      }
      return { ...next, foundationDraft: { draft: outcome.value, generationId: run.id } };
    });
  });
}

async function composeChapter(projectId: string, revise: boolean): Promise<void> {
  const editor = projectEditor(projectId);
  await editor.flush();
  const current = required(editor.getSnapshot().value);
  editor.setPhase(revise ? 'continuity' : 'writing');
  const preferences = current.memory.feedbackPatches.filter(p => p.kind === 'preference').map(p => p.note);
  const outcome = revise
    ? await runChapterRevision(current.truthPackage, current.sourceDraft?.text, current.revisionNote, preferences)
    : await runStoryChapter(current.truthPackage, current.sourceDraft?.text, phase => editor.setPhase(phase), preferences);
  const runs = outcome.runs.map(run => outcome.ok && run.id === outcome.run.id ? { ...run, result: { kind: 'story-chapter' as const, value: outcome.value } } : run);
  await editor.update(value => {
    const latest = required(value); const next = withRuns(latest, runs);
    if (!outcome.ok) { editor.setNotice(outcome.message); return next; }
    if (latest.truthPackage.version !== current.truthPackage.version) {
      editor.setNotice('生成期间设定发生变化。新章节保留在创作记录中，请基于新设定重新编排。'); return next;
    }
    if (revise && JSON.stringify(outcome.value.nodes) === JSON.stringify(current.truthPackage.chapters[0]?.nodes)) {
      editor.setNotice('这次修订没有改变故事。可以补充具体的修改意见。'); return next;
    }
    const admitted = admitChapter(latest.truthPackage, outcome.value, outcome.run.id, now(), { replace: revise });
    if (!admitted.ok) { editor.setNotice(admitted.message); return next; }
    return { ...next, truthPackage: admitted.value, project: { ...next.project, updatedAt: now() } };
  });
}
export function generateProjectChapter(projectId: string, revise = false): Promise<void> {
  const editor = projectEditor(projectId);
  return editor.run('chapter', () => composeChapter(projectId, revise));
}
export function approveProjectAndGenerate(projectId: string): Promise<void> {
  const editor = projectEditor(projectId);
  return editor.run('chapter', async () => {
    await editor.flush();
    await editor.update(value => {
      const current = required(value);
      if (!current.foundationDraft) throw new Error('请先生成并确认故事设定。');
      const { draft, generationId } = current.foundationDraft;
      const admitted = admitFoundation(current.truthPackage, draft, generationId, now());
      if (!admitted.ok) throw new Error(admitted.message);
      const approved = approveBible({ ...admitted.value, adaptationBrief: { ...admitted.value.adaptationBrief!, approval: 'approved' } }, now());
      if (!approved.ok) throw new Error(approved.message);
      return { ...current, truthPackage: approved.value, foundationDraft: undefined, project: { ...current.project, name: draft.title, updatedAt: now() } };
    });
    await composeChapter(projectId, false);
  });
}
