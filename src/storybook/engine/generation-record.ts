export type GenerationRunKind =
  | 'bible-draft'
  | 'scene-text'
  | 'choice-suggestions'
  | 'asset-image'
  | 'story-foundation'
  | 'story-chapter';

export type GenerationProvenance = {
  at: string;
  route?: 'local' | 'cloud';
  /** Portable App AIConfig fingerprint; provider/model identity is Runtime-owned. */
  configHash?: string;
  traceId?: string;
  status: 'succeeded' | 'unavailable';
  reason?: string;
  message?: string;
  technicalDetail?: string;
};

export type GenerationRun = {
  id: string;
  projectId: string;
  kind: GenerationRunKind;
  request: Record<string, unknown>;
  provenance: GenerationProvenance;
  outputRefs: string[];
  /** Actual parsed output, retained even when later author edits prevent admission. */
  result?: { kind: 'story-foundation'; value: FoundationDraft } | { kind: 'story-chapter'; value: ChapterDraft };
};
import type { FoundationDraft, ChapterDraft } from './composer.js';
