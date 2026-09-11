import { sharedEditorSession } from './editor-session.js';
import { getProject, saveProject, getIntakeDraft, saveIntakeDraft } from './storybook-store.js';
import { getDocument, getWorkDraft, saveWorkDraft } from './protocol-store.js';
import { getRecord, putRecord, removeRecord } from './native-repository.js';
import { workFromIdea } from '../engine/protocol/session.js';
import type { StorybookWork } from '../engine/protocol/types.js';

export function projectEditor(projectId: string) {
  return sharedEditorSession(`project:${projectId}`, () => getProject(projectId), async value => { if (value) await saveProject(value); });
}
export function workEditor(documentId: string, initial?: StorybookWork) {
  return sharedEditorSession(`work:${documentId}`, () => {
    const saved = getDocument(documentId);
    return getWorkDraft(documentId)?.text ?? JSON.stringify(saved?.kind === 'work' ? saved.data : initial ?? workFromIdea('一次还没发生的相遇', ''), null, 2);
  }, value => saveWorkDraft(documentId, value));
}
export function intakeEditor() {
  return sharedEditorSession('intake', () => getIntakeDraft() ?? { name: '', text: '', direction: '忠于原文' }, saveIntakeDraft);
}
// @nimi-authority: rule.storybook.protocol.r007
export function dialogueEditor(runId: string) {
  return sharedEditorSession(`dialogue:${runId}`, () => getRecord<{ text: string }>('drafts', `dialogue:${runId}`)?.text ?? '', async text => {
    if (text) await putRecord('drafts', `dialogue:${runId}`, { kind: 'dialogue', runId, text });
    else await removeRecord('drafts', `dialogue:${runId}`);
  });
}
