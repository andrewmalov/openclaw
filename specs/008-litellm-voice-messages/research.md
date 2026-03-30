# Research: LiteLLM Voice Messages

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## 1) Default audio model policy

**Decision**: Use `gpt-4o-audio-preview` as the default model for both inbound audio transcription and outbound voice generation when the LiteLLM path is active and no explicit override is configured.

**Rationale**: The feature input explicitly requires this default. A shared default across recognition and generation also reduces operator confusion and support friction.

**Alternatives considered**:

- Keep existing split defaults (`gpt-4o-mini-transcribe` for transcription and `gpt-4o-mini-tts` for synthesis) — Rejected because it contradicts feature intent and creates asymmetric behavior.
- Require explicit model in config for all voice requests — Rejected for poor out-of-box usability.

---

## 2) LiteLLM base URL and key resolution

**Decision**: Keep existing precedence behavior where explicit runtime config can provide base URL, while environment variables remain first-class for containerized deployment. Voice flows should resolve credentials consistently with current LiteLLM provider patterns and fail with clear diagnostics when missing.

**Rationale**: This aligns with existing OpenClaw LiteLLM behavior and avoids introducing a separate resolution model just for voice.

**Alternatives considered**:

- Environment-only resolution — Rejected because many operators already manage values via config.
- Config-only resolution — Rejected because HOBOT/container flows rely on environment injection.

---

## 3) Inbound voice recognition integration point

**Decision**: Reuse the existing media-understanding audio pipeline and OpenAI-compatible transcription helper, and register LiteLLM as an audio-capable media-understanding provider in `extensions/litellm`.

**Rationale**: Existing media-understanding flow already handles attachment selection, scope checks, and transcript injection. Reusing this path minimizes risk and preserves channel behavior.

**Alternatives considered**:

- Build a parallel transcription subsystem under TTS — Rejected due to duplicated policy logic.
- Hardcode LiteLLM routing inside core runtime without provider registration — Rejected because provider plugins are the established extensibility pattern.

---

## 4) Outbound voice generation integration point

**Decision**: Reuse current OpenAI-compatible TTS request path (`/audio/speech`) and allow LiteLLM endpoint/model override through existing OpenAI TTS config surface, with default model set to `gpt-4o-audio-preview` for this feature path.

**Rationale**: Current TTS path already supports custom OpenAI-compatible base URLs and channel-specific output formats; this is sufficient for LiteLLM-backed voice generation.

**Alternatives considered**:

- Add a brand-new `litellm` TTS provider ID — Rejected for phase-1 scope; existing OpenAI-compatible provider path is enough.
- Route outbound voice through message tool blocks directly — Rejected because TTS runtime already handles truncation, summary, and fallback logic.

---

## 5) Error handling and fallback behavior

**Decision**: Preserve existing non-voice fallback behavior: when transcription or generation fails, return a clear user-visible explanation and continue text-only flow rather than failing the entire turn.

**Rationale**: Matches feature requirement to avoid regressions in non-voice messaging.

**Alternatives considered**:

- Hard-fail the whole turn on voice errors — Rejected as overly disruptive.
- Silent failure with no user message — Rejected due to poor debuggability and user trust.

---

## 6) Testing strategy

**Decision**: Add targeted Vitest coverage for model resolution defaults, config/env precedence, and failure-path fallbacks in media-understanding and TTS modules, plus extension-level provider registration tests.

**Rationale**: Provides confidence without requiring live LiteLLM in CI.

**Alternatives considered**:

- Live-only integration tests against external LiteLLM — Rejected as flaky and environment-dependent.
