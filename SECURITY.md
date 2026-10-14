# Security

## Credential custody

- Do not store Realm credentials, Runtime access tokens, or refresh tokens in this repository or in app-local storage, and do not implement app-local login or OAuth flows.
- **Runtime** owns app registration, active session admission, operation access enforcement, and Nimi credential custody. **Desktop** provides exact Electron Host supervision, process lifecycle management, and user management entrypoints.

## Nimi client

- Use `getStorybookNimiClient` in `src/shell/infra/storybook-nimi-client.ts`, which constructs the client with the host-bound `createNimiClient` paired with `createNimiLocalAppStandardShellSurface`.
- Do not use legacy Tauri IPC paths, direct bare Runtime or Realm requests, or parallel client construction paths.

## Permission posture

- Treat `app_access` declarations in `nimi.app.yaml` as requested scope declarations, not self-granted operational authorization. Runtime enforces active session admission and operation access, Registry/Platform governs catalog review and approved release descriptors, and any separate Integration standing resource permissions remain independent.
- Fail closed when a required capability or contract surface is unavailable.
