import { convertIntake, seedTruthPackage, mintId, createProjectMemory } from '../engine/index.js';
import { clearIntakeDraft, saveProject } from './storybook-store.js';
import { intakeEditor } from './content-editors.js';
import { forgetEditorSession } from './editor-session.js';

// @nimi-authority: rule.storybook.protocol.r007
export async function submitIntake(): Promise<string> {
  const editor = intakeEditor();
  let cleared = false;
  const projectId = await editor.run('submit', async () => {
    await editor.flush();
    const draft = editor.getSnapshot().value;
    if (draft.text.trim().length < 20) throw new Error('再多写一点吧。至少 20 个字，让 AI 能抓住故事的线索。');
    if (draft.text.length > 8000) throw new Error('这一篇请控制在 8000 字以内。');
    const now = new Date().toISOString(); const projectId = mintId('proj');
    const converted = convertIntake({ kind: 'document-text', projectId, title: draft.name || undefined, text: draft.text }, now);
    if (!converted.ok) throw new Error(converted.message);
    const project = { id: projectId, name: draft.name.trim() || '一个正在生长的故事', mode: 'document-backed' as const, truthPackageId: mintId('truthpkg'), createdAt: now, updatedAt: now };
    await saveProject({ project, truthPackage: seedTruthPackage(project, converted.value, now), memory: createProjectMemory(projectId), sourceDraft: { text: draft.text, direction: draft.direction }, generationRuns: [] });
    // Never clear a newer revision, even if another caller edited during handoff.
    if (editor.getSnapshot().value === draft) {
      try { await clearIntakeDraft(); cleared = true; }
      catch { editor.setNotice('故事已创建，原文草稿暂未清理，内容仍保留在本机。'); }
    } else await editor.flush();
    return projectId;
  }, true);
  if (cleared) forgetEditorSession('intake');
  return projectId;
}
