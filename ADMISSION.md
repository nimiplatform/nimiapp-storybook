# Storybook Nimi Listing Request

This document is a developer-submitted listing request. It is not an approval, release descriptor, permission grant, or install truth.

## Developer Runbook

```bash
pnpm install
pnpm dev:shell
pnpm run check
pnpm run pack
```

## Submission Inputs

- `nimi.app.yaml` declares app identity (`nimi.storybook`) and requested API scopes.
- `.nimi/admission/submission.yaml` records publish-readiness commands and review inputs.
- `.nimi/config/build-profile.yaml` records install, build, and lockfile policy.
- `.nimi/spec/storybook/kernel/**` records app-local product authority.
- `.nimi/contracts/scaffold-boundary.yaml` records local auth/runtime/AIConfig boundary checks.
- `dist/nimi-app-submission.json` is produced by `pnpm run pack` after a successful renderer build.

## Reviewer Boundary

Nimi Platform review owns final admission, release descriptors, ordinary-user visibility, install availability, and permission grants.
