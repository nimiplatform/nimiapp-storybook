# Storybook Product Contract

## Rules

### SBK-PROD-01 Truth Package Ownership

`storybook-truth-package` is the canonical product authority for each
Storybook project. Studio, Play, narrative context, render output, and
compatibility exports are projections governed by truth refs.

### SBK-PROD-02 App-Local Scope

Storybook project truth, runs, transcripts, feedback memory, and prepared
packages are app-local and project-scoped. They do not mutate Runtime memory,
Realm world state, shared Nimi memory, or external engine state.

### SBK-PROD-03 Genre Neutrality

Storybook remains genre-neutral. Product authority must not narrow the app to
galgame-only, anime-only, adult-only, prompt-only, or one-shot visual-novel
semantics.

### SBK-PROD-04 Lifecycle Gate

Truth governance lifecycle is `draft`, `foundation-approved`, or `play-ready`.
Promotion to Play requires complete truth prerequisites and validation success;
missing prerequisites fail closed.

### SBK-PROD-05 No Parallel Truth

No Studio form state, Play run state, AI output, render artifact, imported
document, or external package may become a parallel canonical source. Any
retained claim must be admitted into the truth package with evidence or
derivation.

### SBK-PROD-06 External References Are Structural

Realm and Forge alignment is structural reference only. Storybook may import or
fork structural references, but the resulting project truth is owned by the
Storybook project.
