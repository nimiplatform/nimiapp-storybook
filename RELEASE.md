# Release Process

Storybook ships as a Tauri 2 desktop app for macOS, Windows, and Linux.

This document describes the manual / GitHub-Actions release flow for the
standalone single-app layout.

## Triggers

1. Tag push: push an annotated tag matching `vX.Y.Z` or `vX.Y.Z-rc.N` to
   `main`.
2. Manual dispatch: run the release workflow with a semver version and a
   publish flag.

Manual dispatch should default to dry-run until Platform admission is complete.

## Versioning

Semantic Versioning ([semver.org](https://semver.org/)).

- MAJOR: incompatible persisted project schema or removal of an admitted
  `SBK-*` contract.
- MINOR: new product surface, new admitted `SBK-*` rule family, or new canonical
  Storybook record.
- PATCH: bug fix, dependency bump, or refactor with no contract change.

The version string lives in three places that stay in lockstep:

| File | Field |
| --- | --- |
| `package.json` | `"version"` |
| `src-tauri/tauri.conf.json` | `"version"` |
| `src-tauri/Cargo.toml` | `[package].version` |

## Pre-flight Checklist

```bash
pnpm install
pnpm exec nimicoding sync --check
pnpm nimicoding:doctor
pnpm exec nimicoding validate-spec-tree
pnpm exec nimicoding validate-domain-admission --profile nimi --root .nimi/spec
pnpm exec nimicoding validate-table-family --profile nimi --root .nimi/spec
pnpm run check
pnpm run build
pnpm run validate
pnpm run local-audit
pnpm run pack
```

## Tag Flow

```bash
NEW_VERSION=0.1.0
npm version --no-git-tag-version "$NEW_VERSION"
sed -i '' "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" src-tauri/tauri.conf.json
sed -i '' "s/^version = \".*\"/version = \"$NEW_VERSION\"/" src-tauri/Cargo.toml
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml CHANGELOG.md
git commit -m "release: v$NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "Storybook v$NEW_VERSION"
git push origin main
git push origin "v$NEW_VERSION"
```

## Governance Projection Sync

If `@nimiplatform/nimi-coding` ships a new minor/major version, bump it in
`package.json` and rerun:

```bash
pnpm install
pnpm exec nimicoding sync --apply
pnpm nimicoding:doctor
```
