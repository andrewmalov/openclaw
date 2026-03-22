# Contract: LiteLLM Provider Integration

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

## Purpose

Define the functional contract for integrating LiteLLM Proxy as a model provider within existing OpenClaw provider lifecycle: configuration, model catalog exposure, request routing, error semantics, and diagnostics.

## 1) Provider Registration Contract

- The system MUST register LiteLLM under provider id `litellm`.
- LiteLLM registration MUST be additive and MUST NOT remove or alter behavior of existing providers.
- When LiteLLM is disabled or invalidly configured, it MUST be excluded from selectable provider/model lists.

## 2) Configuration Contract

- Required LiteLLM provider fields:
  - Base endpoint URL
  - Auth profile reference (or resolvable API key via existing auth mechanisms)
  - At least one model entry available after default seeding or explicit config
- Validation behavior:
  - Missing required values MUST produce a clear configuration error before request execution.
  - Invalid endpoint/auth data MUST return actionable failure classification.

## 3) Authentication Contract

- Supported auth mode for this feature scope: API key via shared auth-profile storage.
- Default profile id MUST resolve as `litellm:default` when user follows standard onboarding flow.
- Environment-backed credentials via existing provider-env mapping MUST be supported.

## 4) Model Catalog Contract

- LiteLLM MUST expose at least one default model entry after successful setup.
- Operator-provided model definitions MUST override or extend default catalog via existing config semantics.
- Model entries MUST conform to provider model schema used by current model selection/runtime components.

## 5) Inference Routing Contract

- If a selected model belongs to LiteLLM provider, request routing MUST use LiteLLM provider configuration and auth profile.
- Response payload shape returned to callers MUST remain consistent with existing provider response expectations.
- LiteLLM request failures MUST be surfaced with one of these classes:
  - configuration
  - connectivity
  - authentication
  - model availability

## 6) Fallback and Compatibility Contract

- Existing providers MUST remain routable when LiteLLM is disabled or failing.
- Fallback behavior MUST follow existing platform policy and explicit operator configuration.
- Users not using LiteLLM MUST see no regression in provider selection and request completion behavior.

## 7) Diagnostics Contract

- LiteLLM request outcomes MUST appear in existing status/diagnostic surfaces used for providers.
- Diagnostic output SHOULD avoid leaking secrets while retaining actionable error context.

## 8) Documentation Contract

- Operator docs MUST include:
  - Setup prerequisites
  - Required configuration fields
  - Auth setup path
  - Failure classes and remediation guidance
  - Compatibility/fallback behavior
