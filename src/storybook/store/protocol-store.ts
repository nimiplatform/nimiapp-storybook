import type { ImportedDocument, ProtocolDocument, StorybookWork } from '../engine/protocol/types.js';
import type { ExperienceRun } from '../engine/protocol/session.js';
import { parseProtocolDocument } from '../engine/protocol/validate.js';
import { mintId } from '../engine/ids.js';
import { allRecords, getRecord, putRecord, removeRecord } from './native-repository.js';

// @nimi-authority: rule.storybook.protocol.r002
export async function importDocument(data: unknown, sourceName: string, artwork?: string): Promise<ImportedDocument> {
  const { document } = parseProtocolDocument(data);
  const existing = listDocuments().find(d => d.kind === document.kind && JSON.stringify(d.data) === JSON.stringify(document.data));
  if (existing && (!artwork || existing.artwork === artwork)) return existing;
  const imported: ImportedDocument = existing
    ? { ...existing, artwork, sourceName, importedAt: new Date().toISOString() }
    : { ...document, id: mintId('document'), sourceName, importedAt: new Date().toISOString(), ...(artwork ? { artwork } : {}) };
  await putRecord('documents', imported.id, imported); return imported;
}
export function listDocuments(kind?: ProtocolDocument['kind']): ImportedDocument[] {
  return allRecords<ImportedDocument>('documents').filter(d => !kind || d.kind === kind).sort((a, b) => b.importedAt.localeCompare(a.importedAt));
}
export function getDocument(id: string): ImportedDocument | null { return getRecord('documents', id); }
export type WorkDraft = { kind: 'work'; documentId: string; text: string; updatedAt: string };
export function getWorkDraft(documentId: string): WorkDraft | null { return getRecord('drafts', `work:${documentId}`); }
export function listWorkDrafts(): WorkDraft[] { return allRecords<WorkDraft>('drafts').filter(d => d.kind === 'work').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
// @nimi-authority: rule.storybook.protocol.r007
export async function saveWorkDraft(documentId: string, text: string): Promise<void> { await putRecord('drafts', `work:${documentId}`, { kind: 'work', documentId, text, updatedAt: new Date().toISOString() } satisfies WorkDraft); }
export async function clearWorkDraft(documentId: string): Promise<void> { await removeRecord('drafts', `work:${documentId}`); }
// @nimi-authority: rule.storybook.protocol.r005
export async function saveWork(documentId: string, work: StorybookWork): Promise<ImportedDocument> {
  const { document } = parseProtocolDocument(work);
  const previous = getDocument(documentId);
  if (previous && previous.kind !== 'work') throw new Error('这份内容不是可编辑的作品。');
  const saved = { ...previous, ...document, id: documentId, sourceName: `${work.title}.storybook.json`, importedAt: new Date().toISOString() } as ImportedDocument;
  await putRecord('documents', documentId, saved);
  return saved;
}
export function listExperienceRuns(): ExperienceRun[] { return allRecords<ExperienceRun>('experience-runs').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
export function getExperienceRun(id: string): ExperienceRun | null { return getRecord('experience-runs', id); }

// @nimi-authority: rule.storybook.protocol.r005
export async function saveExperienceRun(run: ExperienceRun): Promise<void> {
  const previous = getExperienceRun(run.id);
  if (previous && JSON.stringify(previous.authority) !== JSON.stringify(run.authority)) throw new Error('已开始的经历不能更换设定。请开始一段新经历。');
  await putRecord('experience-runs', run.id, run);
}
