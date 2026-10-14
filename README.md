# Storybook

> An agentic interactive narrative engine and creative studio for living, branching stories.

Storybook is an interactive fiction platform built for both readers and creators. By combining a cinematic, choice-driven reading environment (**Play**) with a structured authoring workbench (**Studio**), Storybook lets you experience and craft branching narratives where AI-powered characters respond in character to your decisions.

---

## Two Distinct Surfaces

### 1. Play (游玩体验)
- **Cinematic Reading**: Immerse yourself in built-in stories (such as *The Rainy Day Letter Shop / 雨天营业的信件店*) or import community story packages.
- **Effortless Agency**: Contextual choices let you steer the narrative without typing, while optional free-form input lets you question characters and improvise whenever inspiration strikes.
- **Flexible Narrative Modes**: In authored works, your choices shape scene progression and relationships according to the story's rules. You can also load standalone character cards for open-ended interaction without mandatory chapters or preset choices.

### 2. Studio (创作者工作台)
- **From Notes to Living Worlds**: Convert unstructured notes, character cards, or short stories into a cohesive Storybook Bible.
- **Agent Cast Orchestration**: Assign distinct behavioral constraints, worldviews, and speech habits to each character in your cast.
- **Branch Topology & Validation**: Inspect scene progression and playtest available branches and lore consistency before exporting.
- **Import & JSON Packaging**: Export prepared stories as JSON once they pass validation. The import screen accepts Character Card V2 (JSON or PNG), Storybook works (JSON), and Lorebooks (JSON) up to 8 MiB per file (these are story content files, not `.nimiapp` application installers).

---

## Technical Architecture & Engine

- **Storybook Engine**: App-owned narrative rule authority that derives scenario frames, active cast dynamics, and scene transcripts from a single canonical story package.
- **AI Execution**: Uses Nimi Runtime's `ai.scenario.execute` with `text-generate`. Author-defined settings guide generation, though creators should still review outputs since model responses can occasionally contradict source constraints.
- **Isolated Story Memory**: Run transcripts, player choices, and branch states stay strictly isolated within the project workspace rather than becoming shared LocalAgent memory. AI requests follow your selected Local or Cloud route.

---

## Getting Started & Development

### Prerequisites
- Node.js ≥ 24, pnpm ≥ 10
- Running Nimi Desktop with an active user account

### Running in Development
```bash
# Install dependencies cleanly
pnpm install --frozen-lockfile

# Launch Desktop-supervised Electron shell
pnpm dev:shell
```

### Verification & Testing
```bash
# Run unit tests and typechecking
pnpm run test
pnpm run typecheck

# Validate story contracts and spec consistency
pnpm run validate
pnpm run local-audit

# Package the application (build and package on the matching target host; use windows-x86_64 on Windows)
pnpm exec nimi-app build --target macos-aarch64
pnpm run pack --target macos-aarch64 --production
```

---

## Data Privacy & Storage

- **Local Workspace**: Storybooks, drafts, and saved runs are held in local App storage. Exporting a story is a separate, explicit sharing action.
- **Cloud Inference Context**: When Cloud inference is selected, the current request sends the relevant story and dialogue context to your selected provider.

---

## Release & Verification Status

- **Verified Publisher Release**: [v0.1.9](https://github.com/nimiplatform/nimiapp-storybook/releases/tag/v0.1.9)
- **Registry Admission**: [#89](https://github.com/nimiplatform/nimi-app-registry/pull/89) (macOS arm64 and Windows x64)
- **Recorded Toolchain Combination**: SDK 0.21.0, Kit/native 0.19.3, App Tools 0.12.1, Nimi Coding 0.6.5
- **Previously Recorded Platform Checks**: macOS arm64 Catalog install and launch, text generation turn with character 青禾 in *雨天营业的信件店*, save/continue story persistence across restarts, and branching choice progression verified. (Windows GUI execution and Studio creator imports marked as `NOT-VERIFIED`).
