# Storybook × Nimi App Access — Phase 2 Acceptance

Date: 2026-08-08. Platform checkout: `../../nimi` branch `spec-4`.

## Decisions applied

- D1: keep the spec-4 sibling `link:` dependencies.
- D2: keep Storybook product records in renderer `localStorage`; App AIConfig is
  Runtime-owned and does not use that product store.
- D3: retire the Tauri shell and its app-owned OAuth command surface.

## Checkpoint results

| Checkpoint | Result | Evidence |
| --- | --- | --- |
| CP1 manifest and identity | pass | `profile: standalone`; only `runtime.consume`; no legacy `permissions`; app-supplied instance/device IDs removed |
| CP2 Electron bridge | pass | forbidden failure callback removed; Electron typecheck and preload bundle pass |
| CP3 App AIConfig | pass | Runtime `aiConfig.get/overwrite`; legacy renderer records quarantined without guessed migration; owner and optimistic conflict tests pass |
| CP4 text generation | pass | `ai.text.generateCandidate`; registered surfaces and unary bounds enforced; image returns typed unavailable |
| CP5 settings | pass | Kit `ModelConfigAIConfigSurface` in third-party App owner mode; removed Runtime model-provider stub |
| CP6 session loss | pass | no session-loss quit path; forced bootstrap retry remains available; protected carrier performed same-Host recovery in the real journey |
| CP7 copy | pass | machine codes are absent from terminal copy and confined to collapsible technical details where displayed |
| CP8 shell retirement | pass | `src-tauri` removed; scripts, dependencies, build profile, pack and release docs are Electron-only |
| CP9 real journey | pass with one post-test note | supervised launch, authenticated posture, positive/negative operations, typed outage, same-Host recovery, and port cleanup observed |

## CP9 real journey

Command:

```bash
pnpm dev -- --cdp-port 9333
```

Observed on the single CDP page target `Storybook` at
`http://127.0.0.1:1473/`:

1. The renderer bootstrap reached `authenticated`, `session-bound` posture.
   The account sign-in transition itself was **not observed** because Desktop
   already had an authenticated account.
2. Portable `text.generate` Local intent was committed through the public
   protected `aiConfig.overwrite` operation and read back through
   `aiConfig.get` with the exact `nimi.storybook` owner.
3. A Play free-text turn called `runtime.consume` and returned real generated
   prose. The guarded output was appended to the narrative spine and transcript.
4. An undeclared `realm.worldCore.list` call returned typed
   `local-app-access-denied`; it did not succeed or mutate Realm.
5. The exact Runtime process was terminated. Desktop started a replacement.
   The replacement was briefly stopped to make the outage window observable;
   `aiConfig.get` returned typed `runtime-service-unavailable`, and the pending
   Play turn surfaced user-facing Runtime unavailability without adding a fake
   spine entry.
6. After the same Runtime process resumed, the same Electron Host retained a
   bound protected session, read the committed App AIConfig, and completed a
   second real text generation. A second guarded spine entry was appended.
7. CDP `Browser.close` removed the app target and released ports 1473 and 9333.

Post-test note: an additional fresh launch attempt after the deliberate Runtime
termination returned platform posture `runtime-service-untrusted`. No app-side
trust reset or Desktop restart was attempted. This did not invalidate the
already-observed same-Host recovery, but a clean fresh-launch observation after
that destructive platform test requires Desktop-owned trust restoration.

## Repository gates

The final run must include:

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
