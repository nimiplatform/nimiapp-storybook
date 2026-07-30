# Storybook Removed Surfaces Contract

## Rules

### SBK-REMOVED-01 Prompt-Only Generator Removal

Prompt-only generator semantics are removed. Storybook generation is governed
by truth package inputs, surface IDs, and Runtime AI Config.

### SBK-REMOVED-02 App-Owned Provider Console Removal

Provider/model console semantics are removed from Storybook product authority.
Kit/SDK AI Config owns model configuration.

### SBK-REMOVED-03 Shared Memory Mutation Removal

Storybook must not write project memory, transcripts, or feedback into Runtime
source memory, Realm world state, or shared ecosystem memory.

### SBK-REMOVED-04 External Engine Dependency Removal

Forge, Realm, and external narrative engines may inform structure, but they are
not runtime dependencies and do not own Storybook truth.
