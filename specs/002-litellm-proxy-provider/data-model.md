# Data Model: LiteLLM Proxy Model Provider Integration

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Entities

### 1) LiteLLM Provider Configuration

- **Purpose**: Stores operator-defined settings that enable and parameterize LiteLLM as a model provider.
- **Core fields**:
  - `providerId` (fixed logical id for provider selection/routing)
  - `baseUrl` (LiteLLM proxy endpoint)
  - `apiMode` (OpenAI-compatible request mode)
  - `enabled` (whether provider is available for routing)
  - `models[]` (optional explicit model definitions/overrides)
- **Validation rules**:
  - Required connection fields must be present before requests can run.
  - When disabled, provider must not be selectable.
  - Base URL must be syntactically valid and normalized consistently with existing provider rules.
- **State transitions**:
  - `disabled -> enabled` when valid config exists.
  - `enabled -> degraded` on runtime connectivity/auth/model failures.
  - `degraded -> enabled` after successful health/request recovery.

### 2) LiteLLM Auth Profile

- **Purpose**: Holds credential reference for LiteLLM requests in shared auth-profile system.
- **Core fields**:
  - `profileId` (default `litellm:default`)
  - `provider` (litellm)
  - `mode` (api_key)
  - `credentialRef` (stored secret or environment-backed reference)
- **Validation rules**:
  - Profile provider must match `litellm`.
  - API key must be present via stored credential or env reference before runtime use.
- **State transitions**:
  - `missing -> configured` when API key is supplied.
  - `configured -> invalid` when key is removed/revoked.
  - `invalid -> configured` after credential refresh.

### 3) Provider Model Catalog Entry

- **Purpose**: Defines models exposed through LiteLLM for user selection and runtime execution.
- **Core fields**:
  - `modelId` (provider-scoped model id)
  - `displayName`
  - `inputCapabilities` (text/image etc.)
  - `reasoningFlag`
  - `limits` (context window, max output tokens where available)
  - `costMetadata` (if available or defaulted)
- **Validation rules**:
  - Model IDs must be non-empty and unique within provider scope.
  - Catalog entry must match provider capabilities schema used by existing model selection.
- **State transitions**:
  - `seeded` (default model available)
  - `overridden` (operator explicit catalog entries applied)
  - `unavailable` (model removed/upstream unavailable but provider remains enabled)

### 4) Inference Request (LiteLLM Route)

- **Purpose**: Represents a user request routed through LiteLLM-selected model.
- **Core fields**:
  - `requestId`
  - `selectedProvider`
  - `selectedModel`
  - `inputPayload`
  - `resultStatus` (success/failure class)
  - `errorClass` (configuration/connectivity/auth/model-availability)
- **Validation rules**:
  - Selected provider/model must be available in current effective catalog.
  - Request must be blocked early if provider config/auth is invalid.
- **State transitions**:
  - `created -> routed -> completed`
  - `created -> rejected` (validation/config/auth)
  - `routed -> failed` (runtime/connectivity/upstream failure)

## Relationships

- LiteLLM Provider Configuration **references** one or more LiteLLM Auth Profiles (default profile first).
- Provider Model Catalog Entries **belong to** LiteLLM Provider Configuration.
- Inference Request **uses** one Provider Configuration + one Model Catalog Entry + one active Auth Profile.

## Compatibility Notes

- Existing providers remain independent entities and must not be mutated when LiteLLM entities are absent or disabled.
- Default model/credential wiring must preserve previous behavior for users who already configured LiteLLM through current onboarding flow.
