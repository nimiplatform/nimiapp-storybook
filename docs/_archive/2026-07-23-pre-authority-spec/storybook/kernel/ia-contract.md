# Storybook IA Contract

## Rules

### SBK-IA-01 Primary Product Split

Storybook has two primary product surfaces: Studio for creators and Play for
ordinary play. Settings exists as platform/app infrastructure and must not
become a third product authoring surface.

### SBK-IA-02 Studio Responsibility

Studio owns source intake, foundation review, playtest, promotion, and advanced
truth/governance controls. Studio may expose validation failures and truth refs.

### SBK-IA-03 Play Responsibility

Play owns reading, choice selection, run continuation, and recoverable
player-facing failure states. Play never exposes Studio authoring controls.

### SBK-IA-04 Choice-First Play

Play is choice-first. Free-text input is optional and cannot be the required
path for ordinary progression.

### SBK-IA-05 Settings Responsibility

Settings owns auth-visible state and AI Config surfaces through Nimi Kit/SDK.
Settings must not duplicate Runtime account truth, permission truth, or release
truth.
