# Storybook Runtime AI Contract

## Rules

### SBK-AI-01 Runtime Account Boundary

Storybook authenticates through a developer-registered Runtime app session and
the Runtime account browser broker. It never stores Runtime or Realm access
tokens.

### SBK-AI-02 No OAuth Exchange Surface

OAuth/token exchange is not an app bridge surface. Any app-owned token exchange
or local first-party auth shim is forbidden.

### SBK-AI-03 AI Config Ownership

AI model selection is owned by SDK `NimiAIConfig` and surfaced through Kit model
configuration UI. Storybook does not own provider routing or model truth.

### SBK-AI-04 Runtime Dispatch Only

Text, image, and future media generation dispatch through Nimi Runtime/SDK
surfaces. App-level REST bypass around SDK is forbidden.

### SBK-AI-05 No Provider Hardcoding

Provider and model identifiers must not be product constants or app-local
routing rules. When returned by Runtime, they may be recorded as provenance
only.

### SBK-AI-06 Typed Unavailability

Missing Runtime, missing subject user, missing AI Config binding, model
resolution failure, runtime dispatch failure, or empty artifact result returns a
typed unavailable state. Storybook never fabricates generated text, choices, or
assets.

### SBK-AI-07 Surface Catalog

Runtime generation requests use registered Storybook surface IDs. The active
surface catalog is `tables/generation-surface-catalog.yaml`.
