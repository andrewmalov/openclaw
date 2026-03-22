# Research: LiteLLM Proxy Model Provider Integration

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## 1) Provider integration point

**Decision**: Implement LiteLLM as a provider-catalog extension (new `extensions/litellm/provider-catalog.ts`) and plug it into existing provider runtime/catalog composition instead of introducing a separate routing subsystem.

**Rationale**: The repository already follows extension-based provider catalogs (e.g., OpenRouter, MiniMax, others). This preserves consistency, minimizes risk, and keeps provider behavior aligned with existing discovery and model-catalog logic.

**Alternatives considered**:

- Add LiteLLM handling directly in core runtime switch/case logic — rejected due to tighter coupling and harder long-term maintenance.
- Reuse only onboarding config without provider catalog module — rejected because runtime model exposure and catalog consistency would remain incomplete.

---

## 2) API compatibility mode and defaults

**Decision**: Treat LiteLLM as OpenAI-compatible for request/response semantics and keep practical defaults already present in onboarding config (base URL and default model seed) while allowing operator override via standard config.

**Rationale**: Existing code already seeds LiteLLM with `openai-completions` style provider settings and default base URL, which indicates expected compatibility and reduces rollout friction.

**Alternatives considered**:

- Introduce a unique LiteLLM API mode — rejected because it adds complexity without clear need for this feature scope.
- Require mandatory explicit base URL/model definitions before use — rejected as too heavy for first-time setup and contrary to current onboarding ergonomics.

---

## 3) Authentication and credential flow

**Decision**: Use existing API-key auth profile flow (`litellm:default`) and environment-variable mapping (`LITELLM_API_KEY`) with no new auth mechanism.

**Rationale**: Repo already has auth-choice and onboarding coverage for LiteLLM API keys; reusing this ensures consistent UX and avoids duplicating secret storage pathways.

**Alternatives considered**:

- Add OAuth/token-exchange path for LiteLLM — rejected as out of scope and not required for primary user stories.
- Provider-specific secret store schema — rejected because current shared auth profile system already supports this use case.

---

## 4) Model catalog strategy

**Decision**: Ship with a safe default LiteLLM model catalog entry and support operator-defined provider models through existing config overlays.

**Rationale**: Users need immediate usability after setup while preserving flexibility for custom LiteLLM deployments that expose different model sets.

**Alternatives considered**:

- Runtime fetch of full dynamic model list from LiteLLM at startup — deferred due to operational variability and larger testing surface.
- No default model entry — rejected because first-run success rate drops and onboarding value is reduced.

---

## 5) Observability and failure semantics

**Decision**: Reuse existing provider runtime diagnostics/status surfaces to report LiteLLM request outcomes and classify failures (configuration, connectivity, auth, model availability).

**Rationale**: Feature requirements call for clear errors and diagnostics; existing provider health/status mechanisms already fit this need and avoid one-off telemetry paths.

**Alternatives considered**:

- Add LiteLLM-only logging channel — rejected as unnecessary divergence.
- Surface raw upstream errors directly — rejected due to safety/UX concerns; errors should be normalized for users.

---

## 6) Testing strategy

**Decision**: Extend colocated Vitest suites in `src/commands` and `src/plugins` for registration, auth-choice wiring, config validation, runtime resolution, and fallback compatibility.

**Rationale**: This matches constitution requirements and current repository testing conventions while ensuring regression protection for existing providers.

**Alternatives considered**:

- Rely only on manual smoke testing — rejected (insufficient evidence and regression risk).
- Add separate E2E-only coverage first — deferred; unit/integration tests provide faster confidence for provider integration layer.
