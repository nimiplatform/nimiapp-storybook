# Storybook Data Model Contract

## Rules

### SBK-DATA-01 Root Record

`StorybookTruthPackage` is the root record for project authority. The canonical
record shape is registered in
`tables/truth-package-records.yaml#storybook_truth_package`.

### SBK-DATA-02 Truth Refs

Every canonical scenario, agent, bible, branch topology, state matrix, chapter,
asset, and rule record uses a resolvable `TruthRef`. Evidence, derivation, and
projection records may only point at known truth refs.

### SBK-DATA-03 Evidence Or Derivation Backing

A truth claim is backed only when it has an evidence binding, a derivation, or
an approved divergence. Unbacked hard rules fail validation.

### SBK-DATA-04 Projection Inputs

Projection inputs declare a projection type and one or more governing truth
refs. Empty governing truth refs or stale/invalid projections block promotion.

### SBK-DATA-05 Agent Visibility

Agent private facts are distinct from public facts. Projection and generation
surfaces must not leak private facts into player-visible output by default.

### SBK-DATA-06 Branch Reachability

Branch topology has a start chapter, chapter set, routes, and switch points.
All declared chapters must be reachable from the start chapter.

### SBK-DATA-07 State And Ending Matrix

The state/ending matrix owns variables, flags, endings, and achievements.
Endings must anchor to known chapters.

### SBK-DATA-08 Generation Run Provenance

Generation runs record request, project, kind, provenance, and output refs on
success or typed unavailability. Provider/model values are provenance from the
resolved AI Config binding, not Storybook authority.
