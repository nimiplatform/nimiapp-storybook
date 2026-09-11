import { getRuntimePlatformProjection } from '../../shell/auth/runtime-platform.js';
import { getExperienceRun, saveExperienceRun } from '../store/storybook-store.js';
import { mintId } from '../engine/ids.js';
import { buildExperienceContext } from '../engine/protocol/context.js';
import { tasksOf } from '../engine/protocol/types.js';
import { hasUsableFallback, taskSupport } from '../engine/protocol/validate.js';
import {
  addPlayerMessage, addCharacterMessage, latestTaskAttempt, taskScope, resolveExperienceParts,
  type ExperienceRun, type GenerationAttempt,
} from '../engine/protocol/session.js';
import { invokeStorybookText } from './storybook-runtime-invokers.js';
import { dialogueEditor } from '../store/content-editors.js';
import { forkExperience } from '../engine/protocol/session.js';

const pending = new Map<string, Promise<ExperienceRun>>();
// Actual finished output awaiting durable commit; never reported as saved progress.
const uncommitted = new Map<string, ExperienceRun>();
export const experienceBusy = (id: string): boolean => pending.has(id);
export const hasUncommittedExperience = (): boolean => uncommitted.size > 0;
export const hasPendingExperienceWork = (): boolean => pending.size > 0 || uncommitted.size > 0;
function activityChanged() { if (typeof window !== 'undefined') window.dispatchEvent(new Event('storybook-experience-updated')); }
const now = () => new Date().toISOString();

export async function recoverExperience(run: ExperienceRun): Promise<ExperienceRun> {
  run = getExperienceRun(run.id) ?? run;
  if (pending.has(run.id)) return run;
  if (!uncommitted.has(run.id) && !run.attempts.some(a => a.status === 'running')) return run;
  return perform(run.id, async () => {
    const current = getExperienceRun(run.id)!;
    const recovered = uncommitted.get(run.id) ?? { ...current, attempts: current.attempts.map(a => a.status === 'running' ? { ...a, status: 'unavailable' as const, reason: 'interrupted', message: '上次生成被中断，可重试。', completedAt: now() } : a) };
    await saveExperienceRun(recovered); uncommitted.delete(run.id); return recovered;
  });
}

// @nimi-authority: rule.storybook.protocol.r005
export function updateExperience(runId: string, change: (current: ExperienceRun) => ExperienceRun): Promise<ExperienceRun> {
  return perform(runId, async () => {
    const current = getExperienceRun(runId);
    if (!current) throw new Error('找不到这段经历。');
    if (current.attempts.some(a => a.status === 'running')) throw new Error('请先恢复上次操作。');
    const next = change(current);
    if (next.id !== runId) throw new Error('更新不能更换经历标识，请使用分叉入口。');
    await saveExperienceRun(next); return next;
  });
}
export function forkSavedExperience(runId: string, checkpointId: string): Promise<ExperienceRun> {
  return perform(runId, async () => {
    const current = getExperienceRun(runId);
    if (!current) throw new Error('找不到这段经历。');
    const fork = forkExperience(current, checkpointId, now());
    await saveExperienceRun(fork); return fork;
  });
}

// @nimi-authority: rule.storybook.protocol.r006
// @nimi-authority: rule.storybook.runtime-ai.r007
export function runExperienceGeneration(runId: string, input: { message: string } | { taskId: string } | { retryDialogue: true }): Promise<ExperienceRun> {
  return perform(runId, () => execute(runId, input));
}

function perform(runId: string, action: () => Promise<ExperienceRun>): Promise<ExperienceRun> {
  const existing = pending.get(runId);
  if (existing) return Promise.reject(new Error('上一项操作尚未完成，这次输入尚未发送，请稍后重试。'));
  const job = Promise.resolve().then(action).finally(() => { pending.delete(runId); activityChanged(); });
  pending.set(runId, job);
  activityChanged();
  return job;
}

async function execute(runId: string, input: { message: string } | { taskId: string } | { retryDialogue: true }): Promise<ExperienceRun> {
  let run = getExperienceRun(runId);
  if (!run) throw new Error('找不到这段经历。');
  if (run.attempts.some(a => a.status === 'running')) throw new Error('请等待当前生成完成。');
  if ('message' in input) run = addPlayerMessage(run, input.message, now());
  if ('retryDialogue' in input && run.events.at(-1)?.kind !== 'user') throw new Error('没有需要重试的对话。');
  const task = 'taskId' in input ? tasksOf(run.authority.work).find(t => t.id === input.taskId) : undefined;
  if ('taskId' in input && !task) throw new Error('找不到生成任务。');
  if (task?.trigger.node && task.trigger.node !== run.nodeId) throw new Error('此任务不在当前场景。');
  const prior = task ? latestTaskAttempt(run, task) : undefined;
  if (prior?.status === 'succeeded' && task?.reuse !== 'never') return run;
  const attempt: GenerationAttempt = {
    id: mintId('attempt'), taskId: task?.id ?? '$dialogue', scope: task ? taskScope(run, task) : `event:${run.events.at(-1)?.id}`,
    capability: task?.capability ?? 'text.generate', status: 'running', outputs: {}, createdAt: now(),
    projectId: run.authority.projectId,
    request: { kind: task ? 'task' : 'dialogue', eventId: run.events.at(-1)?.id, roleId: run.roleId, nodeId: run.nodeId, visit: run.visit },
    inputRefs: [run.authority.id, ...run.authority.sourceRefs, ...(task?.dependsOn ?? [])],
  };
  run = { ...run, attempts: [...run.attempts, attempt], updatedAt: now() };
  await saveExperienceRun(run);
  if ('message' in input) {
    const draft = dialogueEditor(runId);
    if (draft.getSnapshot().value === input.message) await draft.update(() => '').catch(() => undefined);
  }
  const finish = async (patch: Partial<GenerationAttempt>, text?: string) => {
    let next: ExperienceRun = { ...run!, attempts: run!.attempts.map(a => a.id === attempt.id ? { ...a, ...patch, completedAt: now() } : a), updatedAt: now() };
    if (text !== undefined && !task) next = addCharacterMessage(next, text, now(), attempt.id);
    uncommitted.set(runId, next);
    try { await saveExperienceRun(next); }
    catch (error) { throw new Error('这次结果尚未保存到本机，内容暂留在当前 App 中。请重试保存后再继续。', { cause: error }); }
    uncommitted.delete(runId);
    return next;
  };
  try {
    if (task) {
      for (const dep of task.dependsOn ?? []) {
        const dependency = tasksOf(run.authority.work).find(t => t.id === dep)!;
        const result = latestTaskAttempt(run, dependency);
        if (!result || result.status === 'running' || (result.status !== 'succeeded' && !hasUsableFallback(dependency, run.authority.work))) return finish({ status: 'unavailable', reason: 'dependency-unavailable', message: `请先完成「${dependency.label}」。` });
      }
      const unsupported = taskSupport(task, run.authority.work, resolveExperienceParts(run, task.inputs));
      if (unsupported) return finish({ status: 'unavailable', reason: 'capability-unavailable', message: unsupported });
    }
    const context = buildExperienceContext(run, task?.inputs);
    const projection = await getRuntimePlatformProjection();
    if (projection.status !== 'ready') return finish({ status: 'unavailable', reason: 'runtime-not-ready', message: '连接 Nimi 后即可继续。你的输入已保存。', context: context.trace });
    const result = await invokeStorybookText(projection.client, { messages: context.messages, surfaceId: 'nimi.storybook.play.experience' });
    if (!result.ok) return finish({ status: 'unavailable', reason: result.reason, message: result.message, context: context.trace });
    return finish({
      status: 'succeeded', outputs: { [task?.outputs[0].id ?? 'reply']: [{ type: 'text', text: result.text }] }, context: context.trace,
      provenance: { traceId: result.traceId, route: result.route, configHash: result.configHash },
    }, result.text);
  } catch (error) {
    return finish({ status: 'failed', reason: 'generation-failed', message: error instanceof Error ? error.message : '这次生成未完成，请重试。' });
  }
}
