// Storybook data persists through the Nimi native file store; UI reads its committed cache.
import { type StorybookProject, type StorybookTruthPackage } from '../engine/truth.js';
import { type ProjectMemory, createProjectMemory } from '../engine/memory.js';
import { type RegenerationRequest } from '../engine/editor.js';
import { type PreparedStorybookPackage } from '../engine/prepared-package.js';
import { type GenerationRun } from '../engine/generation-record.js';
import { type FoundationDraft } from '../engine/composer.js';

import { type RunRecord } from '../engine/play-session.js';
export { importDocument, listDocuments, getDocument, getWorkDraft, listWorkDrafts, saveWorkDraft, clearWorkDraft, saveWork, listExperienceRuns, getExperienceRun, saveExperienceRun } from './protocol-store.js';
export type { RunRecord } from '../engine/play-session.js';

import { allRecords, getRecord, putRecord, removeRecord } from './native-repository.js';
export { initializeStorybookStore } from './native-repository.js';

export type StoredProjectRecord = {
  project: StorybookProject;
  truthPackage: StorybookTruthPackage;
  memory: ProjectMemory;
  /** Persisted scoped regeneration requests with their lifecycle status (wave-12). */
  regenerationRequests?: RegenerationRequest[];
  revisionNote?: string;
  sourceDraft?: { text: string; direction: string };
  foundationDraft?: { draft: FoundationDraft; generationId: string };
  generationRuns?: GenerationRun[];
};

export type ImportedPackageSource = 'official' | 'local-import';

export type ImportedPackageRecord = {
  id: string;
  label: string;
  source: ImportedPackageSource;
  /** UI entry label only — not an extra package source category. */
  entryLabel: 'recent' | 'recommended' | 'friend-provided' | 'creator-provided';
  package: PreparedStorybookPackage;
  importedAt: string;
  /** Set when a creator's Studio project produced this package — links run promotions back to the project (wave-11). */
  sourceProjectId?: string;
};

export function listProjects(): StoredProjectRecord[] {
  return allRecords<StoredProjectRecord>('projects').sort((a, b) => b.project.updatedAt.localeCompare(a.project.updatedAt));
}
export function getProject(id: string): StoredProjectRecord | null { return getRecord('projects', id); }
export async function saveProject(record: StoredProjectRecord): Promise<void> { await putRecord('projects', record.project.id, record); }
export function ensureProjectMemory(id: string): ProjectMemory { return getProject(id)?.memory ?? createProjectMemory(id); }
export async function deleteProject(id: string): Promise<void> { await removeRecord('projects', id); }
export function listImportedPackages(): ImportedPackageRecord[] {
  return allRecords<ImportedPackageRecord>('packages').sort((a, b) => b.importedAt.localeCompare(a.importedAt));
}
export function getImportedPackage(id: string): ImportedPackageRecord | null { return getRecord('packages', id); }
export async function saveImportedPackage(record: ImportedPackageRecord): Promise<void> { await putRecord('packages', record.id, record); }
export function listRuns(packageId?: string): RunRecord[] {
  return allRecords<RunRecord>('story-runs').filter(r => !packageId || r.packageId === packageId).sort((a, b) => b.run.updatedAt.localeCompare(a.run.updatedAt));
}
export function getRun(id: string): RunRecord | null { return getRecord('story-runs', id); }
export async function saveRun(record: RunRecord): Promise<void> { await putRecord('story-runs', record.run.id, record); }
export function getIntakeDraft(): { name: string; text: string; direction: string } | null { return getRecord('drafts', 'intake'); }
export async function saveIntakeDraft(value: { name: string; text: string; direction: string }): Promise<void> { await putRecord('drafts', 'intake', value); }
export async function clearIntakeDraft(): Promise<void> { await removeRecord('drafts', 'intake'); }
