# Pre-Authority Storybook Spec Archive Manifest

This archive preserves the legacy Storybook specification tree moved from `.nimi/spec` during the 2026-07-23 canonical authority hard cut.

## Archived Files

1. `INDEX.md`
2. `storybook/AGENTS.md`
3. `storybook/design-system.md`
4. `storybook/index.md`
5. `storybook/kernel/data-model-contract.md`
6. `storybook/kernel/ia-contract.md`
7. `storybook/kernel/index.md`
8. `storybook/kernel/product-contract.md`
9. `storybook/kernel/removed-surfaces-contract.md`
10. `storybook/kernel/runtime-ai-contract.md`
11. `storybook/kernel/tables/generation-surface-catalog.yaml`
12. `storybook/kernel/tables/removed-surface-names.yaml`
13. `storybook/kernel/tables/rule-catalog.yaml`
14. `storybook/kernel/tables/truth-package-records.yaml`
15. `storybook/storybook.md`
16. `storybook/user-storybook.md`

## Archived Source Disposition

| Archived source | Disposition or canonical destination |
| --- | --- |
| `INDEX.md` | Guide-level; archived, not migrated. |
| `storybook/AGENTS.md` | Guide-level; archived, not migrated. |
| `storybook/index.md` | Guide-level; archived, not migrated. |
| `storybook/kernel/index.md` | Guide-level; archived, not migrated. |
| `storybook/user-storybook.md` | Guide-level; archived, not migrated. |
| `storybook/design-system.md` | Guide-level; archived, not migrated. |
| `storybook/storybook.md` | Covered by `definition.storybook.product.truth-package`, `definition.storybook.product.projection-surface`, and `rule.storybook.product.r003`. |

## Legacy Rule Traceability

| Legacy rule ID | Canonical unit ID |
| --- | --- |
| `SBK-PROD-01` | `rule.storybook.product.r001` |
| `SBK-PROD-02` | `rule.storybook.product.r002` |
| `SBK-PROD-03` | `rule.storybook.product.r003` |
| `SBK-PROD-04` | `rule.storybook.product.r004` |
| `SBK-PROD-05` | `rule.storybook.product.r005` |
| `SBK-PROD-06` | `rule.storybook.product.r006` |
| `SBK-DATA-01` | `rule.storybook.data-model.r001` |
| `SBK-DATA-02` | `rule.storybook.data-model.r002` |
| `SBK-DATA-03` | `rule.storybook.data-model.r003` |
| `SBK-DATA-04` | `rule.storybook.data-model.r004` |
| `SBK-DATA-05` | `rule.storybook.data-model.r005` |
| `SBK-DATA-06` | `rule.storybook.data-model.r006` |
| `SBK-DATA-07` | `rule.storybook.data-model.r007` |
| `SBK-DATA-08` | `rule.storybook.data-model.r008` |
| `SBK-AI-01` | `rule.storybook.runtime-ai.r001` |
| `SBK-AI-02` | `rule.storybook.runtime-ai.r002` |
| `SBK-AI-03` | `rule.storybook.runtime-ai.r003` |
| `SBK-AI-04` | `rule.storybook.runtime-ai.r004` |
| `SBK-AI-05` | `rule.storybook.runtime-ai.r005` |
| `SBK-AI-06` | `rule.storybook.runtime-ai.r006` |
| `SBK-AI-07` | `rule.storybook.runtime-ai.r007` |
| `SBK-IA-01` | `rule.storybook.ia.r001` |
| `SBK-IA-02` | `rule.storybook.ia.r002` |
| `SBK-IA-03` | `rule.storybook.ia.r003` |
| `SBK-IA-04` | `rule.storybook.ia.r004` |
| `SBK-IA-05` | `rule.storybook.ia.r005` |
| `SBK-REMOVED-01` | `rule.storybook.removed-surfaces.r001` |
| `SBK-REMOVED-02` | `rule.storybook.removed-surfaces.r002` |
| `SBK-REMOVED-03` | `rule.storybook.removed-surfaces.r003` |
| `SBK-REMOVED-04` | `rule.storybook.removed-surfaces.r004` |

## Legacy Table Traceability

| Legacy table | Canonical unit IDs or disposition |
| --- | --- |
| `storybook/kernel/tables/generation-surface-catalog.yaml` | `definition.storybook.runtime-ai.surface-catalog`, `definition.storybook.runtime-ai.surface.studio-bible`, `definition.storybook.runtime-ai.surface.play-scene`, `definition.storybook.runtime-ai.surface.play-choices`, `definition.storybook.runtime-ai.surface.studio-asset`, and `rule.storybook.runtime-ai.r007` |
| `storybook/kernel/tables/removed-surface-names.yaml` | `definition.storybook.removed-surfaces.prompt-only-generator`, `definition.storybook.removed-surfaces.app-owned-provider-console`, `definition.storybook.removed-surfaces.shared-memory-writer`, `definition.storybook.removed-surfaces.external-engine-runtime-dependency`, and `rule.storybook.removed-surfaces.r001` through `rule.storybook.removed-surfaces.r004` |
| `storybook/kernel/tables/truth-package-records.yaml` | `definition.storybook.data-model.truth-package-record`, `rule.storybook.data-model.r001`, `rule.storybook.data-model.r002`, `rule.storybook.data-model.r003`, `rule.storybook.data-model.r004`, `rule.storybook.product.r004`, `rule.storybook.data-model.r008`, and `rule.storybook.runtime-ai.r005` |
| `storybook/kernel/tables/rule-catalog.yaml` | Superseded by canonical unit IDs. |
