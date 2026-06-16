# Storybook Kernel Authority Map

Normative Storybook authority lives in the following contract families.

| Contract | Rule Family | Governs |
| --- | --- | --- |
| [product-contract.md](product-contract.md) | `SBK-PROD-*` | Product boundaries, truth ownership, lifecycle semantics |
| [data-model-contract.md](data-model-contract.md) | `SBK-DATA-*` | `storybook-truth-package`, evidence, derivation, projection, run records |
| [runtime-ai-contract.md](runtime-ai-contract.md) | `SBK-AI-*` | Runtime auth, SDK/Kit AI Config, generation failure posture |
| [ia-contract.md](ia-contract.md) | `SBK-IA-*` | Studio, Play, settings, ordinary-user/creator separation |
| [removed-surfaces-contract.md](removed-surfaces-contract.md) | `SBK-REMOVED-*` | Hard removals and forbidden reintroductions |

## Kernel Tables

| Table | Governs |
| --- | --- |
| [tables/rule-catalog.yaml](tables/rule-catalog.yaml) | Stable rule family catalog |
| [tables/truth-package-records.yaml](tables/truth-package-records.yaml) | Canonical `storybook-truth-package` record shape |
| [tables/generation-surface-catalog.yaml](tables/generation-surface-catalog.yaml) | Runtime AI generation surface IDs |
| [tables/removed-surface-names.yaml](tables/removed-surface-names.yaml) | Names whose active return fails closed |
