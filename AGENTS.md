# Storybook AGENTS.md

> Authoritative module-level instructions for AI agents working on Storybook.

## Identity

- Canonical Nimi app_id: `nimi.storybook`
- Product slug: `storybook`
- Electron host app_id: `nimi.storybook`
- One-line: A genre-neutral interactive narrative app with Studio, Play, and
  an app-owned truth-package Engine.
- Status: Pre-Alpha, not launched.

## Architecture

| Layer | Technology | Location |
|-------|------------|----------|
| Desktop shell | Electron, Desktop-supervised | `src-electron/` |
| Frontend | React 19 + Vite 7 | `src/` |
| Product authority | v2 canonical authority + app-local Storybook Engine | `.nimi/spec/storybook/canonical/**`, `src/storybook/engine/**` |
| Runtime / auth | Nimi SDK + Kit auth broker | `src/shell/infra/**`, `src/shell/auth/**`, `src/shell/app-shell/**` |
| AI config | Runtime-owned App AIConfig + Kit ModelConfig | `src/storybook/ai/storybook-ai-config-store.ts`, `src/shell/ai/**` |
| UI components | `@nimiplatform/kit` | Public npm dependency selected by app-tools sync |
| Dev port | 1473 | `package.json`, `nimi.app.yaml` |

## Spec Authority & Sync

`.nimi/spec/storybook/**` is Storybook's project-local product authority.
Normative product authority belongs only in closed v2 containers under
`.nimi/spec/storybook/canonical/*.authority.yaml`.

Refresh the package-managed authoring guide with:

```bash
pnpm exec nimicoding sync --apply
```

When spec and code conflict, classify implementation behavior against the
kernel authority first. Retained behavior may update spec only through an
explicit redesign/admission decision; otherwise align implementation or track
the mismatch as a defect. Do not promote bugs, fail-open behavior, placeholder
data writes, orphan surfaces, or implementation-only behavior into authority.

Before making product changes:

1. Read `.nimi/methodology/authority-authoring.yaml`.
2. Read the affected canonical container or bounded authority context.
3. Read the affected source under `src/storybook/**`, `src/shell/**`, and
   tests under `test/**`.

### Key Contracts

| Contract | Rule Family | Governs |
|----------|-------------|---------|
| `.nimi/spec/storybook/canonical/product.authority.yaml` | Product boundaries, truth ownership, lifecycle |
| `.nimi/spec/storybook/canonical/data-model.authority.yaml` | Truth package, refs, evidence, projection, run provenance |
| `.nimi/spec/storybook/canonical/runtime-ai.authority.yaml` | Runtime auth, SDK/Kit AI Config, dispatch boundaries |
| `.nimi/spec/storybook/canonical/ia.authority.yaml` | Studio, Play, settings separation |
| `.nimi/spec/storybook/canonical/removed-surfaces.authority.yaml` | Hard removals |

## Boundaries

- Storybook Engine (`src/storybook/engine/**`) implements the app-owned
  rule-of-truth authority defined by `.nimi/spec/storybook/canonical/**`. The
  `storybook-truth-package` is canonical; Studio, Play, render, and runtime
  generation surfaces are projections with governing truth refs.
- Runtime account auth uses a Desktop-supervised local-app session. Desktop and
  the protected carrier own admission, authorization, and credentials;
  Storybook observes public session posture and caller-scoped handles only.
- AI execution flows only through protected App Access SDK surfaces and a
  Runtime-owned App AIConfig. No provider/model hardcoding, no app-local provider
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
pnpm run spec:authority:check
pnpm run spec:authority:compile
```

## Retrieval Defaults

Start with: `.nimi/spec/storybook/canonical/`, `src/storybook/engine/`,
`src/storybook/ai/`, `src/storybook/store/`, `src/storybook/ui/`,
`src/shell/infra/`, `src/shell/ai/`, `src/shell/app-shell/`, `test/`.

Skip: `node_modules/`, `dist/`, `dist-electron/`,
lockfiles, `.nimi/cache/`, `.nimi/local/`, `.nimi/topics/`.

<!-- nimicoding:managed:agents:start -->
# Nimi Coding Managed Block

- From the repository root, invoke the pinned project-local CLI as `pnpm exec nimicoding`; do not probe or rely on a global `nimicoding` binary in `PATH`.
- Product authority lives under `.nimi/spec/**`.
- Choose authority and code queries when their declared scope can resolve an uncertainty that affects the current task; reuse sufficient current evidence. Query scope is not the limit of host reasoning or authorized work, and hypotheses are not product authority.
- For canonical authority authoring, read only `.nimi/methodology/authority-authoring.yaml`, the affected authority files or bounded task context, and CLI diagnostics.
- Use `pnpm exec nimicoding authority context <path> <id> --max-units <n> --max-bytes <n> --json` only for the complete declared outgoing interpretation closure; it is not complete task context, and failure never permits guessed or partial context.
- Use `pnpm exec nimicoding authority diff` and `pnpm exec nimicoding authority impact` with explicit `--max-bytes`; impact reports declared review obligations and does not prove implementation, consumers, or tests are synchronized.
- Use `pnpm exec nimicoding authority change-candidates` only with explicit channels and budgets; its complete union is recall input, never conflict, retirement, absence, authority, or conformance judgment.
- When explicit authority links are needed, use `pnpm exec nimicoding code authority --repo <root> --authority <id> --max-files <n> --max-bytes <n>` to locate annotated code, and use `--source <path>` for code-to-authority lookup. Results cover only explicit markers and authority lifecycle; they do not prove implementation conformance or evaluate unannotated code.
- For a new or changed authority-governed feature, add the reserved standalone physical line `// @nimi-authority: <exact-id>` in TypeScript/TSX, Go, or Rust, and `# @nimi-authority: <exact-id>` in Python. The scanner does not prove language comment context, so use this reserved form only for intentional links at a few key semantic owners.
- Use `// @nimi-deprecated: <exact-id>`, or `# @nimi-deprecated: <exact-id>` in Python, only after direct authority evidence or a real product failure confirms obsolete semantics; find it with `pnpm exec nimicoding code authority --repo <root> --audit --max-files <n> --max-bytes <n>` and remove it with the hard cut.
- When a selected TypeScript or TSX consumer still has a static-dependency question, use `pnpm exec nimicoding code context <path> --repo <root> --symbol <identifier> --tsconfig <path> --max-bytes <n>` for bounded root-direct static dependencies; it is not inbound impact, runtime dispatch, or complete task context.
- Use `pnpm exec nimicoding sync --check` to diagnose drift in package-owned managed projections, `pnpm exec nimicoding sync --apply` to restore them, and `pnpm exec nimicoding doctor` to diagnose package/managed compatibility. These commands do not validate product authority, implementation conformance, or task readiness.
- Under `.nimi/spec/**`, author only closed multi-unit `*.authority.yaml` containers or single-unit `*.authority.md`; historical document formats are unsupported and never inferred.
- Run `pnpm exec nimicoding authority fmt` on each changed file, then `pnpm exec nimicoding authority check` on the complete authority input set.
- A failed project-local `pnpm exec nimicoding ...` invocation supplies no usable result. Pause decisions that require refused, missing, or incomplete results; continue independent authorized work. Never substitute guessed, corpus-wide, or fallback context, or treat diagnostics or partial output as complete context; choose repair values only from product/task authority.
- Keep derived and local verification output under `.nimi/local/**`; it is never product authority.
<!-- nimicoding:managed:agents:end -->
