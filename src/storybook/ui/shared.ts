import { type ImportedPackageRecord, saveRun } from '../store/storybook-store.js';
import {
  startRun,
  createTranscript,
  appendTranscriptEntry,
  validatePreparedPackage,
  type PreparedStorybookPackage,
} from '../engine/index.js';

export function endingCountOf(prepared: PreparedStorybookPackage): number {
  return new Set(
    prepared.playableChapters
      .flatMap((chapter) => chapter.nodes)
      .filter((node) => node.isEnding)
      .map((node) => node.endingId),
  ).size;
}

export function titleOf(record: ImportedPackageRecord): string {
  return record.package.presentation?.title || record.label;
}
export function coverOf(record: ImportedPackageRecord): string | undefined {
  const ref = record.package.assetManifest.find(
    (a) => a.kind === 'background' && a.present,
  )?.artifactRef;
  // Packaged artwork is an app-relative asset; arbitrary imported URLs do not
  // cause background requests to another site or load an executable protocol.
  return ref && /^\.\/stories\/[a-z0-9-]+\.jpg$/.test(ref) ? ref : undefined;
}
export async function beginStory(record: ImportedPackageRecord): Promise<string> {
  const prepared = record.package;
  const report = validatePreparedPackage(prepared);
  if (!report.valid) throw new Error('这本故事暂时无法打开。请重新导入完整的故事文件。');
  const chapter = prepared.playableChapters.find((c) => c.id === prepared.startSemantics.chapterId);
  if (!chapter) throw new Error('找不到故事的开场。');
  const now = new Date().toISOString();
  const run = startRun({
    projectId: record.sourceProjectId ?? record.id,
    packageId: record.id,
    chapter,
    variables: prepared.stateMatrix.variables,
    flags: prepared.stateMatrix.flags,
    now,
  });
  const transcript = appendTranscriptEntry(createTranscript(run.id), {
    at: now,
    kind: 'enter-node',
    detail: chapter.nodes.find((n) => n.id === run.currentNodeId)?.title || chapter.title,
    nodeId: run.currentNodeId,
  });
  await saveRun({ packageId: record.id, run, transcript, checkpoints: [] });
  return run.id;
}
export function relativeDate(value: string): string {
  const date = new Date(value);
  const elapsed = Date.now() - date.getTime();
  if (!Number.isFinite(elapsed)) return '';
  if (elapsed < 60_000) return '刚刚';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} 分钟前`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} 小时前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}
