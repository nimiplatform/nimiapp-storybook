# Storybook × Nimi App Access — Gap Audit (Phase 1, read-only)

Date: 2026-08-08. Scope: read-only audit of `nimiapp-storybook` against the
declarative App Access contract for third-party Local Apps. No source file was
modified in this phase; the only write is this report.

Platform reference: `/Users/snwozy/nimi-realm/nimi` @ branch `spec-4`, HEAD
`b4fa5f045` ("feat(dev): unify supervised app launch and shared builds").
Reference apps: `nimi/apps/tester` (canonical), `nimi/apps/zhiyu` (product).

---

## 1. Executive summary

- **The tree is already red against the linked spec-4 SDK/Kit.** `pnpm
  typecheck` fails with 46 renderer errors; `pnpm test` fails 1 of 40
  (`test/ai-config-repair.test.mjs` dies at import time). The SDK no longer
  exports the AIConfig pure-function surface Storybook's AI layer is built on,
  and Kit's `features/model-config` / `features/model-picker/runtime` exports
  changed or were removed. This is not a small call-point swap; the AI config
  store, the settings model-config UI, and the runtime invokers all need
  rework.
- **The app cannot currently boot under the supervised Electron shell.**
  `src-electron/main.ts:33` passes `onProtectedSessionFailure` to
  `registerNimiElectronAppBridge`; Kit 0.3.0 (linked) rejects unknown/
  authority-shaped input keys with `electron-local-app-bridge-input-forbidden`
  at registration time (`nimi/kit/shell/electron/src/main/app-bridge.ts:133-153`,
  breaking change noted in `nimi/kit/CHANGELOG.md:28-32`).
- **The manifest would be hard-rejected by the Runtime.** `nimi.app.yaml:6`
  still carries legacy `permissions: []` and no `app_access`; the Runtime
  manifest loader rejects legacy permission fields and requires `app_access`
  (`nimi/runtime/internal/services/app/local_development_manifest.go:66-76`).
- **Published npm packages predate App Access.** npm has `@nimiplatform/sdk
  0.6.0`, `@nimiplatform/kit 0.2.0`, `@nimiplatform/app-tools 0.1.3` (all
  published 2026-05-24/25). The spec-4 checkouts are `kit 0.3.0` and
  `app-tools 0.2.0`, and the App Access breaking changes sit in kit's
  `Unreleased` section (`nimi/kit/CHANGELOG.md:10-45`). Consuming the new
  contract today is only possible via the sibling checkout `link:` deps that
  `package.json:36-37,47` already use.
- **The renderer's actual Nimi contact surface is narrow:** one
  `auth.status()` probe (`src/shell/infra/storybook-bootstrap.ts:46`), the Kit
  standard-shell bridge, and a Tauri log invoke. No storage/realm/agents/
  conversation/currentUser usage anywhere in `src/`.
- **Recommended minimal `app_access` domain set: `runtime.consume` only**
  (for `ai.text.generateCandidate`). Base operations (app-storage, app-config)
  need no domain. Storybook has no agent consumption (`agent.local` unneeded)
  and treats Realm as structural reference only (`realm.data` unneeded).
- **Contract correction:** the task brief's "exactly 14 operations" is stale.
  spec-4 defines **20 operations** (5 Base + 15 AppAccess across **4 domains**;
  `agent.configure` was added) — `nimi/runtime/internal/localappop/contract.go:91-112`,
  row-count check at `:160`; domain closed set at
  `nimi/app-tools/lib/app-access-declaration.mjs:3-8`.

## 2. Current-state inventory

### 2.1 Dependencies & toolchain (`package.json`)

| Dep | Storybook now | tester (in-repo) | Notes |
|---|---|---|---|
| `@nimiplatform/sdk` | `link:../../nimi/sdks/typescript` (`:37`) | `workspace:*` | spec-4 checkout = `0.6.0`; npm `0.6.0` predates App Access content |
| `@nimiplatform/kit` | `link:../../nimi/kit` (`:36`) | `workspace:*` | spec-4 = `0.3.0`; npm latest `0.2.0` (pre-App-Access) |
| `@nimiplatform/app-tools` | `link:../../nimi/app-tools` (`:47`) | `workspace:*` | provides `nimi-app` bin; spec-4 = `0.2.0`, npm `0.1.3` |
| `@nimiplatform/kit-protected-local-win32-x64` | `link:.../npm/win32-x64` (`:48`) | — (absent) | **dead dep**: zero code references (grep: only `package.json` + lockfile); win32 carrier binary on a macOS dev repo |
| `@nimiplatform/nimi-coding` | `0.4.0` published (`:50`) | `0.5.0` published | spec tooling, unrelated to runtime |

Scripts already match the supervised shape: `dev` = `nimi-app dev --shell
electron` (`package.json:12`), and `dev:renderer` = `vite --host 127.0.0.1
--port 1473 --strictPort` (`:13`) — the exact script form the Desktop
supervisor enforces (`nimi/apps/desktop/src-electron/local-development-plan.ts:49-56`).
tester has no `prepare:workspace-surfaces`; in-repo apps use
`nimi/scripts/with-workspace-surfaces.mjs` around typecheck/build/test —
meaningless for an external repo with real `node_modules`.

### 2.2 Manifest (`nimi.app.yaml:1-9`) vs tester (`nimi/apps/tester/nimi.app.yaml:1-12`)

| Field | Storybook | tester | Verdict |
|---|---|---|---|
| `profile` | `workspace-app` (`:4`) | `standalone` | flip (external repo layout; runtime ignores it, scaffold/docs semantics) |
| `permissions` | `[]` (`:6`) | absent | **delete** — legacy field, Runtime hard-rejects |
| `app_access` | absent | 4 domains | **add** minimal set (§5) |
| `renderer_origin` | `127.0.0.1:1473` (`:9`) | `:1468`; zhiyu `:1472` | keep 1473 — unique |

Same stale `profile: workspace-app` in `.nimi/admission/submission.yaml:3` and
`scaffoldProfile = 'workspace-app'` in `src/shell/auth/runtime-platform.ts:7`
(no other consumers).

### 2.3 Electron shell

- `src-electron/main.ts:29-34` — registers the Kit bridge with
  `onProtectedSessionFailure: () => app.quit()` (`:33`): doubly wrong — the
  field is rejected by Kit 0.3.0 (startup throw), and the semantics are
  "suicidal session-loss", the exact anti-pattern the new contract forbids.
  Session-loss posture must be typed unavailable + same-Host retry; Kit itself
  owns bounded same-Host rebind (`nimi/kit/shell/electron/src/main/local-app-host.ts:233-268`).
- `src-electron/preload.cts:1-7` — `installNimiElectronRuntimeBridge`, correct.
- `pnpm typecheck:electron` is broken on its own: `TS2688 Cannot find type
  definition file for 'electron'` (tsconfig types resolution), which currently
  masks any Electron-side type errors.
- tester reference shape: exactly `{appId, allowedRendererUrls, ipcMain}`
  (`nimi/apps/tester/src-electron/main.ts:24-29`).

### 2.4 Renderer Nimi call surface (exhaustive, `src/**`)

| Capability | Call point | Status |
|---|---|---|
| Session posture | `client.auth.status()` — `src/shell/infra/storybook-bootstrap.ts:46`; client built at `src/shell/infra/storybook-nimi-client.ts:12-16` | in use, correct pattern |
| Text generation | `createNimiRuntimeAISchedulingClient` / `createNimiRuntimeAIModel(...).generateText` — `src/storybook/ai/storybook-runtime-invokers.ts:190-243` | wired but unreachable; symbols removed in spec-4 SDK → typecheck-red |
| Image generation | `client.features.generation.createRuntimeClient(...).submit` — `storybook-runtime-invokers.ts:289-295` | wired but unreachable; **no App Access counterpart** |
| Runtime health | `projection.client.runtime.health({})` — `src/storybook/ai/storybook-runtime.ts:29` | unreachable (projection never `ready`, see below) |
| AIConfig persistence | SDK pure fns + `localStorage` — `src/storybook/ai/storybook-ai-config-store.ts:1-28,56-70,223-303` | in use; SDK exports removed in spec-4 → typecheck-red, test import fails |
| Model-config settings UI | Kit `ModelConfigAiModelHub` etc. — `src/shell/ai/storybook-ai-model-config-section.tsx:2-14,71-74` | in use; Kit exports changed → typecheck-red |
| Product data store | raw `window.localStorage` — `src/storybook/store/storybook-store.ts:64-66` | in use; no SDK `storage.*` consumption |
| Tauri log channel | `invokeTauri('log_renderer_event')` — `src/shell/infra/renderer-log.ts:69-75` | in use, benign |
| `storage.*` / `aiConfig.*` (client) / `realm.*` / `agents.*` / `conversation.*` / `currentUser.*` | — | **zero references** |

Generation gate: `getRuntimePlatformProjection()`
(`src/shell/auth/runtime-platform.ts:43-60`) never returns `ready`;
authenticated posture maps to typed `unavailable` /
`storybook-generic-runtime-generation-not-admitted`, so all runtime AI paths
above are fail-closed today (locked by `test/runtime-bootstrap-auth.test.mjs:85-89`).

### 2.5 Verification baseline (recorded 2026-08-08)

- `pnpm typecheck` → **46 renderer errors**, all in `src/shell/ai/*` and
  `src/storybook/ai/*` (missing SDK `…/ai` exports: `NimiAIConfig`,
  `createNimiAIConfigStore`, `validateNimiAIConfig`, …; missing Kit
  `features/model-config` exports: `ModelConfigAiModelHub`,
  `SharedAIConfigService`, …; `kit/features/model-picker/runtime` module gone).
- `pnpm test` → 39 pass / 1 fail; `test/ai-config-repair.test.mjs` throws at
  import (`areNimiAIScopeRefsEqual` no longer exported by `@nimiplatform/sdk/ai`).
- `pnpm typecheck:electron` → fails on `TS2688` (electron types), pre-existing.

## 3. Residual scan

Zero-hit confirmations (full-repo `rg`, exclusions: `node_modules`, `dist`,
`src-tauri/target|gen`, `.nimi/cache|local`, lockfiles):

- `SendAppMessage` / `agents.configure` / `configureAgent` / `localAgentId` /
  `local_agent` — **zero hits**.
- `requestPermission` / `accessRequest` / `permissionRequest` — **zero hits**.
- Durable agent-handle persistence (`agentHandle` anywhere) — **zero hits**.
- Direct network: no `fetch`/`WebSocket`/`EventSource`/non-loopback URL in
  executable code; no tokens/credentials/bearer material handled by the app.
- Artifact put/read API, voice streaming — **zero hits** (`artifact*` hits are
  engine-internal asset refs, e.g. `src/storybook/engine/assets.ts:31-110`;
  `voice*` hits are character-tone product fields, e.g.
  `src/storybook/engine/intake.ts:31,170,213`).

True residuals (must be removed or reworked in Phase 2):

| # | Location | Residual | Disposition |
|---|---|---|---|
| R1 | `src-electron/main.ts:33` (+ lock at `test/runtime-bootstrap-auth.test.mjs:52`) | `onProtectedSessionFailure: () => app.quit()` | delete field; invert test assertion; Kit owns rebind |
| R2 | `nimi.app.yaml:6` (+ lock at `test/runtime-bootstrap-auth.test.mjs:49`) | legacy `permissions: []` | replace with `app_access`; update test |
| R3 | `src/shell/auth/runtime-platform.ts:43-60`, `src/storybook/ai/storybook-runtime-invokers.ts:11-312`, `src/storybook/ai/storybook-runtime.ts` | old first-party runtime-AI path (`client.runtime`, scheduling, `features.generation`) | delete; text moves to `ai.text.generateCandidate`; image → gap G1 |
| R4 | `src/contracts/app-identity.ts:8-9` | `STORYBOOK_RUNTIME_APP_INSTANCE_ID` / `STORYBOOK_RUNTIME_DEVICE_ID` — app-supplied instance/device identity, zero consumers | delete (carrier owns identity) |
| R5 | `package.json:48` | dead `kit-protected-local-win32-x64` link dep | delete |
| R6 | `src-tauri/src/main.rs:109-110` | app-side OAuth commands (`oauth::open_external_url`, `oauth_listen_for_code`) from shared crate `nimi_shell_tauri` | decision D3: retire Tauri shell or gate these off; forbidden under App Access |
| R7 | `nimi.app.yaml:4`, `.nimi/admission/submission.yaml:3`, `src/shell/auth/runtime-platform.ts:7` | `workspace-app` profile | flip to `standalone` |

Benign / not residuals: product-internal review vocabulary
(`approveBible`, `AdaptationApproval`, Guard `APPROVED` — governed by
`.nimi/spec/storybook/canonical/product.authority.yaml`); Tauri ACL
`"permissions": ["core:default"]` (`src-tauri/capabilities/default.json:6`);
platform reason-code constants (`ReasonCode.APP_TOKEN_EXPIRED/REVOKED` at
`storybook-runtime-invokers.ts:75-76`); governance docs stating forbidden
shortcuts (`AGENTS.md`, `SECURITY.md`, `.nimi/contracts/scaffold-boundary.yaml`,
`scripts/local-audit.mjs:9`); archived pre-authority docs under
`docs/_archive/**` (non-normative; leave unless a docs-zero-residual policy is
desired).

## 4. Capability mapping (existing → App Access)

| Storybook capability | Current implementation | App Access surface | Verdict |
|---|---|---|---|
| Session posture / gate | `auth.status()` + 4-state gate + manual retry (`storybook-bootstrap.ts:46`, `src/shell/app-shell/auth-provider.tsx:17-32,49-55`) | `auth.status()` (same) | **keep**; align posture/rebind semantics with zhiyu (`nimi/apps/zhiyu/src/shell/runtime/runtime-status.ts:9-48`, `auth-gate.tsx:54-56`) |
| Text generation | fail-closed invokers on `client.runtime` | `ai.text.generateCandidate` — needs `runtime.consume`; unary bounds ≤8 msgs / 32KiB msg / 64KiB total / maxTokens ≤4096 | **replace** (CP4) |
| Image generation | fail-closed `features.generation` client | — | **product gap G1** — no surface; keep typed unavailable; do not invent |
| AIConfig persistence | SDK pure fns over `localStorage` (removed in spec-4) | `aiConfig.get/overwrite` (Base, no domain); portable intent, no owner/ConnectorGrant/custody fields | **replace** store backend (CP3) |
| Model-config settings UI | Kit model-config hub (exports changed) | Kit 0.3.0 model-config exports (App-AIConfig owner mode) | **rebuild** against new exports (CP5) |
| Product data (projects, truth packages, runs) | raw `localStorage` (`storybook-store.ts:64-66`) | `storage.readJson/writeJson/removeJson` (Base) | **optional migration** (D2); localStorage is already app-partitioned by the WebView, but `runtime.app-storage` is the sanctioned channel |
| Realm promotion | structural, fail-closed validation only (`src/storybook/engine/realm.ts:197,240-255`); no client | `realm.world-core.{list,create}` needs `realm.data` | **no declaration now**; remains structural reference per AGENTS.md |
| Agents / conversation | none | `agents.listReferences` + conversation ×5 needs `agent.local` | **no declaration** |
| `currentUser.get` | none | Base posture surface | not needed |

## 5. Minimal domain set

```yaml
app_access:
  - runtime.consume
```

Only `runtime.consume` (text candidate generation). Base ops
(`runtime.app-storage.json.*`, `runtime.ai.app-config.*`) require no domain.
Unknown entries would be inert (`nimi/runtime/internal/appaccess/declaration.go:13-33`)
but nothing unknown is declared. If a future product decision makes Realm
promotion executable, add `realm.data` then.

## 6. Gaps register (platform-side; record only, no cross-repo fixes)

- **G1 — Image generation has no App Access surface.** Storybook's image
  invoker (`storybook-runtime-invokers.ts:289-295`) maps to nothing in the
  20-op contract. UI already degrades to typed unavailable; keep that.
- **G2 — Platform scaffold template emits a rejected field.**
  `nimi/app-tools/lib/app-scaffold-profiles.mjs:253` still generates
  `onProtectedSessionFailure: () => app.quit()` for new apps, which Kit 0.3.0
  refuses at startup. Storybook must not copy that template as-is.
- **G3 — No published npm build carries App Access yet.** Consuming the
  contract requires the spec-4 sibling checkout until `kit ≥0.3.0` /
  `app-tools ≥0.2.0` (and the matching SDK) are published.
- **G4 — strictPort race.** The brief lists a known platform race around
  `strictPort`; no platform doc/issue found in the spec-4 checkout (searched
  docs/CHANGELOGs). Mitigation locally: exclusive port 1473 (§2.2) and the
  Desktop-enforced exact `dev:renderer` script, which Storybook already
  matches.
- **G5 — Generic runtime-AI surface dropped.** The old NimiAIConfig-bound
  scheduling/route-policy knobs (`routePolicy`, `model`, scheduling `peek`)
  have no counterpart; Runtime owns implementation selection. Product accepts
  `ai.text.generateCandidate`'s unary, runtime-selected semantics.

## 7. Toolchain options (external-repo consumption)

| Option | Mechanism | Pros | Cons |
|---|---|---|---|
| **A (recommended for Phase 2)** | Keep `link:../../nimi/{kit,sdks/typescript,app-tools}` at spec-4 | Only source of the new contract; zero publishing wait | Not portable; breaks if sibling checkout moves/branch changes; CI needs the checkout |
| B | Pin published npm (`sdk 0.6.0`, `kit 0.2.0`, `app-tools 0.1.3`) | Portable, cacheable | **Blocked by G3** — published builds predate App Access; bridge/manifest/CLI semantics differ. Revisit after platform publishes |
| C | `pnpm pack` tarballs from spec-4 + `file:` deps | Portable, reproducible | Manual repack on every platform change; drift risk |

Also in Phase 2: remove the dead win32 carrier dep (R5); keep the local
`build:electron` (`tsc` + `scripts/bundle-electron-preload.mjs`) — tester's
equivalent uses an in-repo platform script unavailable externally; fix
`tsconfig.electron.json` electron-types resolution (§2.3).

## 8. Phase-2 adaptation plan (checkpoints; each ends buildable + focused tests green)

1. **CP1 — Manifest & identity.** `nimi.app.yaml`: `profile: standalone`,
   drop `permissions`, add `app_access: [runtime.consume]`. Flip
   `submission.yaml:3` / `runtime-platform.ts:7`. Delete R4 constants, R5 dep.
   Update `test/runtime-bootstrap-auth.test.mjs:41,49-50` assertions.
2. **CP2 — Electron bridge.** Remove `onProtectedSessionFailure` (R1); invert
   its test lock; fix `typecheck:electron` (TS2688). Manual smoke: bridge
   registers, no startup throw.
3. **CP3 — AIConfig store rebuild** on `aiConfig.get/overwrite` (Base ops),
   porting the repair/quarantine/CAS semantics of
   `storybook-ai-config-store.ts:143-267`; revive `test/ai-config-repair.test.mjs`.
4. **CP4 — Text generation** via `ai.text.generateCandidate` with unary
   bounds enforced app-side; delete old invokers/projection not-admitted path
   (R3); update `storybook-engine`/`dataflow`/`runtime-bootstrap-auth` tests.
   Image path → typed unavailable (G1).
5. **CP5 — Settings model-config UI** rebuilt against Kit 0.3.0 model-config
   exports; drop `storybook-runtime-model-provider.ts` (dead stub on a
   removed module).
6. **CP6 — Session-loss posture.** Verify unavailable + same-Host retry
   end-to-end (gate retry already re-runs bootstrap,
   `auth-provider.tsx:49-55`); ensure no app-quit paths remain on session loss.
7. **CP7 — Copy pass.** No reason codes/machine codes in terminal UI
   (collapsible technical sections only); first-run/unconfigured states use
   informational copy (`src/storybook/ai/storybook-unavailable.ts:23-52`,
   `src/shell/ai/model-config-copy.ts`).
8. **CP8 — Tauri shell decision (D3).** Retire `src-tauri` shell or strip the
   OAuth command surface (R6); align `build`/`lint`/`pack` scripts.
9. **CP9 — Real journey acceptance** per task brief §4.4 (supervised
   `nimi-app dev --shell electron -- --cdp-port <free>`; CDP bound to this app
   only; observe sign-in posture, `runtime.consume` positive, one undeclared-op
   typed denial, Runtime kill → typed unavailable → same-Host recovery, clean
   exit). Honest `not_observed` where applicable; report stays in this repo.

Open decisions for the user: **D1** toolchain option (recommend A); **D2**
migrate product data to `storage.*` now or defer (recommend defer); **D3**
Tauri shell retire vs strip (recommend retire: official dev path is Electron,
`--shell` admits only Electron, and R6 is forbidden surface).

## 9. Risks

- **Moving platform branch.** spec-4 is unreleased; further breaking kit/sdk
  changes will re-break the tree (as already happened once). Mitigate: record
  the audited HEAD (`b4fa5f045`), re-run `pnpm check` after any platform pull.
- **AIConfig semantics shift.** `runtime.ai.app-config.*` stores portable
  intent without owner/custody fields; the existing local store carries
  `targetRef` (`connectorId`/`profileBindingId`) shapes that may not survive
  validation — CP3 must redefine the stored shape, including quarantine of
  legacy `localStorage` entries.
- **Text-only generation.** Product flows that assumed images (e.g. asset
  generation in Studio) remain unavailable until G1 is addressed by the
  platform; UX must not imply otherwise.
- **Test-suite coupling to platform strings.** `runtime-bootstrap-auth.test.mjs`
  asserts exact manifest/bridge shapes; expect several assertion rewrites
  (CP1/CP2/CP4) — keep them as positive locks on the new contract.
- **Tauri removal fallout** (if D3 = retire): `pack`/`RELEASE.md`/
  `.nimi/config/*` reference the Tauri build; needs a release-process update.

## 10. Citation self-check (5 random re-greps, run after drafting)

| # | Claim | Command | Result |
|---|---|---|---|
| 1 | `nimi/runtime/internal/localappop/contract.go:160` expects twenty rows | `rg -n "expected twenty rows" contract.go` | see below |
| 2 | `nimi/app-tools/lib/app-scaffold-profiles.mjs:253` emits `onProtectedSessionFailure` | `rg -n "onProtectedSessionFailure" app-scaffold-profiles.mjs` | see below |
| 3 | `nimi/apps/desktop/src-electron/local-development-plan.ts:49-56` enforces exact `dev:renderer` | `rg -n "dev:renderer|strictPort" local-development-plan.ts` | see below |
| 4 | `nimi/apps/zhiyu/src/shell/runtime/runtime-status.ts:9-18` bridge-unavailable typed posture | `rg -n "electron-runtime-bridge-unavailable" runtime-status.ts` | see below |
| 5 | `nimi/runtime/internal/services/app/local_development_manifest.go:66-76` rejects legacy `permissions` | `rg -n "permissions" local_development_manifest.go` | see below |

### Self-check output (verbatim, 2026-08-08)

```
1: runtime/internal/localappop/contract.go:160:
   return fmt.Errorf("%w: expected twenty rows", ErrContractInvalid)        ✓

2: app-tools/lib/app-scaffold-profiles.mjs:253:
   '    onProtectedSessionFailure: () => app.quit(),',                       ✓

3: apps/desktop/src-electron/local-development-plan.ts:51:
   || scripts['dev:renderer'] !== `vite --host 127.0.0.1 --port ${new URL(rendererOrigin).port} --strictPort`  ✓

4: apps/zhiyu/src/shell/runtime/runtime-status.ts:13:
   reasonCode: 'electron-runtime-bridge-unavailable',                        ✓

5: runtime/internal/services/app/local_development_manifest.go:66-67:
   if _, legacy := rawShape["permissions"]; legacy {
       return "", "", localAppManifest{}, errors.New("legacy permissions are not admitted")  ✓
```

All 5 sampled citations confirmed verbatim.
