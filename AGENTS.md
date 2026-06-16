# Storybook AGENTS.md

> Authoritative module-level instructions for AI agents working on Storybook.

## Identity

- Canonical Nimi app_id: `nimi.storybook`
- Product slug: `storybook`
- Tauri identifier: `nimi.storybook`
- One-line: A genre-neutral interactive narrative app with Studio, Play, and
  an app-owned truth-package Engine.
- Status: Pre-Alpha, not launched.

## Architecture

| Layer | Technology | Location |
|-------|------------|----------|
| Desktop shell | Tauri 2 | `src-tauri/` |
| Frontend | React 19 + Vite 7 | `src/` |
| Product authority | `.nimi/spec/storybook/kernel/**` + app-local Storybook Engine | `.nimi/spec/storybook/kernel/**`, `src/storybook/engine/**` |
| Runtime / auth | Nimi SDK + Kit auth broker | `src/shell/infra/**`, `src/shell/auth/**`, `src/shell/app-shell/**` |
| AI config | SDK NimiAIConfig + Kit ModelConfig | `src/storybook/ai/storybook-ai-config-store.ts`, `src/shell/ai/**` |
| UI components | `@nimiplatform/kit` | npm dependency via `link:../../nimi/kit` |
| Dev port | 1472 | `vite.config.ts`, `src-tauri/tauri.conf.json` |

## Spec Authority & Sync

`.nimi/spec/storybook/**` is Storybook's project-local product authority.
Normative product authority belongs only in
`.nimi/spec/storybook/kernel/*.md` and `.nimi/spec/storybook/kernel/tables/**`.
`.nimi/spec/INDEX.md`, `.nimi/spec/storybook/index.md`,
`.nimi/spec/storybook/storybook.md`, `.nimi/spec/storybook/user-storybook.md`,
`.nimi/spec/storybook/design-system.md`, and `.nimi/spec/storybook/AGENTS.md`
are reading guides / authoring rules.

`.nimi/{methodology,contracts,config}/**` is the nimicoding governance
projection. Refresh package-owned seeds with:

```bash
pnpm exec nimicoding sync --apply
```

When spec and code conflict, classify implementation behavior against the
kernel authority first. Retained behavior may update spec only through an
explicit redesign/admission decision; otherwise align implementation or track
the mismatch as a defect. Do not promote bugs, fail-open behavior, placeholder
data writes, orphan surfaces, or implementation-only behavior into authority.

Before making product changes:

1. Read `.nimi/spec/INDEX.md`.
2. Read `.nimi/spec/storybook/AGENTS.md`.
3. Read `.nimi/spec/storybook/kernel/index.md`, then the relevant contract and
   kernel table.
4. Read the affected source under `src/storybook/**`, `src/shell/**`, and
   tests under `test/**`.

### Key Contracts

| Contract | Rule Family | Governs |
|----------|-------------|---------|
| `.nimi/spec/storybook/kernel/product-contract.md` | `SBK-PROD-*` | Product boundaries, truth ownership, lifecycle |
| `.nimi/spec/storybook/kernel/data-model-contract.md` | `SBK-DATA-*` | Truth package, refs, evidence, projection, run provenance |
| `.nimi/spec/storybook/kernel/runtime-ai-contract.md` | `SBK-AI-*` | Runtime auth, SDK/Kit AI Config, dispatch boundaries |
| `.nimi/spec/storybook/kernel/ia-contract.md` | `SBK-IA-*` | Studio, Play, settings separation |
| `.nimi/spec/storybook/kernel/removed-surfaces-contract.md` | `SBK-REMOVED-*` | Hard removals |

## Boundaries

- Storybook Engine (`src/storybook/engine/**`) implements the app-owned
  rule-of-truth authority defined by `.nimi/spec/storybook/kernel/**`. The
  `storybook-truth-package` is canonical; Studio, Play, render, and runtime
  generation surfaces are projections with governing truth refs.
- Runtime account auth uses a developer-registered Runtime app session.
  Storybook never stores Runtime/Realm access tokens and never exposes OAuth
  token exchange.
- AI execution flows only through SDK/Runtime surfaces and an SDK
  `NimiAIConfig` binding. No provider/model hardcoding, no app-local provider
  routing, no fabricated output. Missing binding/runtime fails closed to typed
  unavailable.
- Storybook memory/run/transcript/feedback data is app-internal and
  project-scoped only. Realm is structural reference only; Forge and external
  narrative engines are design references, not imports.
- `.nimi/admission/**` is a developer-submitted input. Platform admission,
  release descriptors, ordinary-user visibility, and permission grants are
  platform-owned after review.

## Forbidden Shortcuts

- No app-level REST bypass around SDK.
- No local-first-party auth shim.
- No duplicate auth/session/permission/admission truth.
- No local canonical mirror of Runtime/Realm data.
- No provider/model constants as product truth.
- No compatibility dual-write or pseudo-success state.
- No importing Runtime internals or Desktop product source.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm lint
pnpm run build
pnpm run validate
pnpm run local-audit
pnpm nimicoding:doctor
pnpm exec nimicoding validate-spec-tree
pnpm exec nimicoding validate-domain-admission --profile nimi --root .nimi/spec
pnpm exec nimicoding validate-table-family --profile nimi --root .nimi/spec
```

## Retrieval Defaults

Start with: `.nimi/spec/storybook/kernel/`, `src/storybook/engine/`,
`src/storybook/ai/`, `src/storybook/store/`, `src/storybook/ui/`,
`src/shell/infra/`, `src/shell/ai/`, `src/shell/app-shell/`, `test/`.

Skip: `node_modules/`, `dist/`, `src-tauri/target/`, `src-tauri/gen/`,
lockfiles, `.nimi/cache/`, `.nimi/local/`, `.nimi/topics/`.

<!-- nimicoding:managed:agents:start -->
# Nimi Coding Managed Block

- Read .nimi/methodology, .nimi/spec, and .nimi/contracts before high-risk changes.
- Treat .nimi as the primary AI truth surface for this project.
- Treat `/.nimi/spec/**` as the current repo-wide product authority for this project, and use Git history for retired pre-cutover authority evidence.
- If .nimi/spec remains bootstrap-only, use .nimi/methodology/spec-reconstruction.yaml and .nimi/config/skills.yaml to drive AI-side truth reconstruction.
- Treat .nimi/methodology/spec-target-truth-profile.yaml as repo-local support guidance for future governance slices, not as the canonical reconstruction completion target or a guaranteed fresh-bootstrap seed.
- Treat .nimi/contracts/spec-reconstruction-result.yaml, .nimi/contracts/doc-spec-audit-result.yaml, .nimi/contracts/high-risk-execution-result.yaml, and .nimi/contracts/high-risk-admission.schema.yaml as machine contracts for reconstruction, audit, local-only high-risk closeout summaries, and local-only high-risk admission evidence.
- Treat .nimi/config/skill-manifest.yaml, .nimi/config/host-profile.yaml, .nimi/config/host-adapter.yaml, .nimi/config/external-execution-artifacts.yaml, .nimi/config/skill-installer.yaml, .nimi/methodology/skill-runtime.yaml, .nimi/methodology/skill-installer-result.yaml, .nimi/methodology/skill-handoff.yaml, and admitted package-owned adapter profiles under adapters/**/profile.yaml as the canonical bridge to any external AI/skill execution.
- Treat standalone nimicoding as boundary-complete for bootstrap, handoff, validation, projection, and explicit admission only; do not assume packaged run-kernel, provider, scheduler, notification, or automation ownership.
- Treat .nimi/config/installer-evidence.yaml and .nimi/methodology/skill-installer-summary-projection.yaml as the operational-to-semantic installer projection boundary; do not promote concrete evidence artifacts into semantic truth.
- Treat high-risk external execution closeout, decision, ingest, and review payloads under .nimi/local/** as local-only operational projections; they do not promote semantic truth automatically, even when manager-owned.
- Use high-risk packetized execution only when authority, ownership, or cross-layer risk justifies it.
- Keep inline manager-worker as the default methodology posture; do not assume a separate worker runtime is mandatory.
- Keep code changes AI-context-efficient: favor bounded, cohesive files and split by responsibility during implementation instead of first concentrating unrelated logic into one file.
- Keep the methodology continuity-agnostic; do not assume daemon, heartbeat, or persistent manager ownership.
- Treat cutover readiness as preflight evidence only; the authority flip must come from an admitted cutover batch, not from readiness green by itself.
- Do not treat this managed block as a replacement for project-specific rules outside .nimi.
<!-- nimicoding:managed:agents:end -->
