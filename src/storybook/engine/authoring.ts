// Studio-side authoring mutations on the app-owned truth package. These are
// explicit, deterministic edit operations (no AI required) that move a project
// through foundation review. Chapter admission is handled by composer.ts. Every mutation
// bumps the package version and marks derived projections stale, so a projection
// is never silently treated as fresh.

import { type Result, ok, fail } from './failure.js';
import { type StorybookTruthPackage, bumpVersion } from './truth.js';

// Authority mutations bump the version and stale projections through the shared helper.
const bumpAndStale = bumpVersion;

/** Foundation review gate: approve the Bible. Chapter scaffolding is blocked until this. */
export function approveBible(
  pkg: StorybookTruthPackage,
  now: string,
): Result<StorybookTruthPackage> {
  if (!pkg.bible)
    return fail('truth_package_section_incomplete', '尚无 Storybook Bible 可供审批。', ['bible']);
  const next = bumpAndStale(
    {
      ...pkg,
      bible: { ...pkg.bible, approved: true },
      governance: {
        ...pkg.governance,
        lifecycle:
          pkg.governance.lifecycle === 'draft' ? 'foundation-approved' : pkg.governance.lifecycle,
        reviewState: 'reviewed',
      },
    },
    now,
  );
  return ok(next);
}

/** Apply an AI-drafted (or hand-edited) Bible body. The text is creator-reviewed content. */
export function applyBibleDraft(
  pkg: StorybookTruthPackage,
  draft: { worldSummary?: string; styleFingerprint?: string; rhythmProfile?: string },
  now: string,
): Result<StorybookTruthPackage> {
  if (!pkg.bible)
    return fail('truth_package_section_incomplete', '尚无 Storybook Bible 可供编辑。', ['bible']);
  return ok(
    bumpAndStale(
      {
        ...pkg,
        bible: {
          ...pkg.bible,
          worldSummary: draft.worldSummary ?? pkg.bible.worldSummary,
          styleFingerprint: draft.styleFingerprint ?? pkg.bible.styleFingerprint,
          rhythmProfile: draft.rhythmProfile ?? pkg.bible.rhythmProfile,
        },
      },
      now,
    ),
  );
}
