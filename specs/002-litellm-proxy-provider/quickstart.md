# Quickstart: LiteLLM Provider Integration

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Goal

Implement LiteLLM Proxy as an operational model provider that can be configured, selected, and used in existing workflows without breaking other providers.

## Implementation Order

1. **Provider catalog integration**
   - Add `extensions/litellm/provider-catalog.ts` following existing provider catalog patterns.
   - Ensure provider id `litellm` resolves to OpenAI-compatible API mode and usable default model metadata.

2. **Runtime/provider wiring**
   - Wire LiteLLM provider into catalog/runtime resolution paths in `src/plugins`.
   - Ensure provider enable/disable behavior matches existing provider governance semantics.

3. **Auth and onboarding alignment**
   - Reuse existing LiteLLM auth-choice/onboarding paths.
   - Verify `litellm:default` profile and env-key reference behavior remain consistent.

4. **Model visibility and selection**
   - Verify LiteLLM models appear in model listing and are selectable where other providers are supported.
   - Confirm invalid configuration prevents selection with clear errors.

5. **Diagnostics and fallback**
   - Ensure LiteLLM request outcomes are visible in existing diagnostics/status surfaces.
   - Validate behavior when LiteLLM is unavailable and fallback policy applies.

6. **Documentation updates**
   - Document configuration, expected defaults, failure classes, and compatibility behavior.

## Suggested Files To Touch

- `extensions/litellm/provider-catalog.ts` (new)
- `src/plugins/provider-catalog.ts`
- `src/plugins/provider-runtime.ts`
- `src/plugins/provider-auth-storage.ts`
- `src/commands/onboard-auth.config-litellm.ts`
- `src/secrets/provider-env-vars.ts`
- Relevant colocated tests in `src/plugins/*.test.ts` and `src/commands/*.test.ts`

## Test Plan (targeted)

- Provider registration/catalog:
  - LiteLLM appears when configured.
  - LiteLLM is hidden when disabled.
- Auth path:
  - API key config creates/uses `litellm:default`.
  - Missing key yields clear failure.
- Request path:
  - Selected LiteLLM model request succeeds with valid config.
  - Connectivity/auth/model failures return classified errors.
- Regression:
  - Existing provider flows are unchanged when LiteLLM is absent/disabled.

## Done Criteria

- LiteLLM behaves as a first-class provider in setup, selection, request, and diagnostics.
- Backward compatibility for non-LiteLLM workflows is preserved.
- Tests covering integration and regressions pass.
