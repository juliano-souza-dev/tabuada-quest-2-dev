# Engineering Rules

## Source of truth
- The currently active branch is the only source of truth for implementation work.
- Before every change, inspect the latest commit/HEAD and base the change on that state.
- Do not restore, copy, or infer behavior from older branches or historical commits unless explicitly requested.
- Historical commits may be inspected only to diagnose a regression, never treated as the implementation baseline.

## Module isolation
- Features must be implemented behind explicit module contracts.
- A module must not reach into another module's internal state when a resolver, adapter, event, or public API can express the dependency.
- Changing one module must not silently alter unrelated modules or gameplay behavior.
- Do not change an existing cross-module contract unless the requested feature requires it.
- New dependencies must be passed explicitly through constructors/options or public interfaces.
- Keep domain identifiers distinct. For example, npcId and shipId are different identities and must be resolved by their owning modules.

## Regression discipline
- Keep patches scoped to the requested behavior.
- Before committing, inspect the touched call chain and its direct consumers for contract breakage.
- Preserve unrelated behavior by default.
- If a requested change necessarily affects another module, make that impact explicit and update both sides of the contract in the same change.
