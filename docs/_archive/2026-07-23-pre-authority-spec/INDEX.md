# Storybook Spec Index

Storybook product authority is organized under the active `storybook` domain.
Kernel markdown files and kernel tables carry product semantics; top-level
domain files are reading guides only.

## Active Product Domains

- `storybook`

## Reading Order

1. Open `storybook/index.md` for the domain reading guide.
2. Open `storybook/kernel/index.md` for the authority map.
3. Open the relevant `storybook/kernel/*.md` contract and the matching
   `storybook/kernel/tables/*.yaml` table when the change is table-shaped.
4. For implementation-bearing changes, update `/src/storybook/**`,
   `/src/shell/**`, and `/test/**` in the same change.

## Authority Rules

- `.nimi/spec/storybook/kernel/**` is the only normative Storybook product
  authority in this repository.
- `.nimi/{methodology,contracts,config}/**` is the nimicoding governance
  projection owned by `@nimiplatform/nimi-coding`; refresh it with
  `pnpm exec nimicoding sync --apply`.
- `.nimi/local/**`, `.nimi/cache/**`, and `.nimi/topics/**` are local execution
  or lifecycle workspaces; they do not promote product truth.
