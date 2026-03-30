# Tasks: LiteLLM Voice Messages

**Input**: Design documents from `/specs/008-litellm-voice-messages/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/README.md](./contracts/README.md)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no hard dependencies)
- **[Story]**: User story from [spec.md](./spec.md) (`US1`–`US3`)
- Paths are repo-root relative

---

## Phase 1: Setup (Feature Scaffolding)

**Purpose**: Prepare bundled LiteLLM extension for audio understanding integration.

- [x] T001 Create `extensions/litellm/media-understanding-provider.ts` and export a LiteLLM audio transcription provider using existing OpenAI-compatible media helper APIs
- [x] T002 Update `extensions/litellm/index.ts` to register the media-understanding provider in addition to existing web-search provider registration
- [x] T003 [P] Add/adjust extension-level tests in `extensions/litellm/` to verify provider registration and plugin load behavior

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared defaults and resolution behavior required by all user stories.

**⚠️ CRITICAL**: No user-story implementation starts before these tasks are complete.

- [x] T004 Set LiteLLM audio default model fallback to `gpt-4o-audio-preview` in `extensions/litellm/media-understanding-provider.ts` for transcription requests with no explicit model
- [x] T005 Update outbound TTS default model resolution for LiteLLM OpenAI-compatible path in `src/tts/tts.ts` and related helpers in `src/tts/tts-core.ts`
- [x] T006 [P] Verify/adjust config schema typing and validation in `src/config/types.tools.ts` and `src/config/zod-schema.agent-runtime.ts` for any new or clarified LiteLLM voice settings
- [x] T007 [P] Update config docs text in `src/config/schema.help.ts` and labels in `src/config/schema.labels.ts` for voice-related LiteLLM behavior where needed

**Checkpoint**: Shared model/base resolution and config semantics are stable for all voice flows.

---

## Phase 3: User Story 1 - Convert Voice Message to Text Reply (Priority: P1) 🎯 MVP

**Goal**: Inbound voice messages are transcribed through LiteLLM and used for assistant response generation.

**Independent Test**: Send a supported voice message and verify the assistant responds using recognized speech content with no manual transcript step.

### Tests for User Story 1

- [x] T008 [P] [US1] Add/extend tests in `src/media-understanding/providers/openai-compatible-audio.ts` and `src/media-understanding/providers/openai/audio.test.ts` for default model fallback to `gpt-4o-audio-preview`
- [x] T009 [P] [US1] Add/extend media pipeline tests in `src/media-understanding/runner.auto-audio.test.ts` for LiteLLM provider selection and transcript propagation

### Implementation for User Story 1

- [x] T010 [US1] Wire LiteLLM media-understanding provider into runtime provider registry via `extensions/litellm/index.ts` and verify capability is `audio`
- [x] T011 [US1] Ensure transcript output is preserved and consumed by normal assistant turn flow in `src/media-understanding/runtime.ts` and `src/media-understanding/runner.ts`
- [x] T012 [US1] Add user-safe error mapping for transcription failures (unsupported/corrupt/timeout/upstream) in `src/media-understanding/providers/shared.ts` and provider wrappers

**Checkpoint**: US1 is independently functional and testable.

---

## Phase 4: User Story 2 - Receive Spoken Assistant Response (Priority: P2)

**Goal**: Assistant can generate outbound voice replies via LiteLLM-compatible audio speech endpoint.

**Independent Test**: Request audio output and verify channel receives playable voice/media reply matching assistant text.

### Tests for User Story 2

- [x] T013 [P] [US2] Add/extend TTS tests in `src/tts/tts.test.ts` and `src/tts/providers/openai.ts` test coverage for LiteLLM-compatible base URL + default model behavior
- [x] T014 [P] [US2] Add channel delivery regression tests (where applicable) in `extensions/telegram/src/voice.test.ts` and/or relevant channel send tests for voice media fallback behavior

### Implementation for User Story 2

- [x] T015 [US2] Update OpenAI-compatible TTS request construction in `src/tts/tts-core.ts` and `src/tts/providers/openai.ts` to use resolved LiteLLM defaults when model is unset
- [x] T016 [US2] Preserve channel-specific output format logic and voice-note compatibility in `src/tts/tts.ts` while routing generation through configured LiteLLM endpoint
- [x] T017 [US2] Ensure outbound audio generation failures degrade gracefully to text response in `src/tts/tts.ts` and `src/infra/outbound/message-action-runner.ts`

**Checkpoint**: US2 is independently functional and testable.

---

## Phase 5: User Story 3 - Predictable Default Audio Model Behavior (Priority: P3)

**Goal**: Default model `gpt-4o-audio-preview` is consistently used for both transcription and generation when no override is configured.

**Independent Test**: In a clean config, run voice input + output flows and verify effective model is default; then set override and verify override wins.

### Tests for User Story 3

- [x] T018 [P] [US3] Add config/env precedence tests in `src/secrets/runtime.test.ts` and any relevant runtime config collectors for model/base resolution
- [x] T019 [P] [US3] Add end-to-end-ish regression coverage in `src/media-understanding/transcribe-audio.test.ts` and `src/tts/tts.test.ts` for default-vs-override model selection

### Implementation for User Story 3

- [x] T020 [US3] Add explicit model-resolution helper(s) or metadata capture for default-vs-override source in `src/media-understanding/*` and `src/tts/*`
- [x] T021 [US3] Ensure operator override paths remain authoritative and do not regress existing non-voice behavior in `src/config/*` and runtime resolution modules
- [x] T022 [US3] Emit diagnostic-safe outcome details for model selection/failures without leaking secrets in `src/secrets/runtime-web-tools.ts` or equivalent runtime diagnostics surface

**Checkpoint**: US3 is independently functional and testable.

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: Documentation, consistency, and final verification.

- [x] T023 [P] Update `specs/008-litellm-voice-messages/quickstart.md` if final config keys or verification steps changed during implementation
- [x] T024 [P] Update provider docs in `docs/providers/litellm.md` to include voice recognition/generation usage and default model behavior
- [x] T025 Run verification commands from plan: `pnpm check` and targeted `pnpm test -- <path-or-filter>` for touched modules
- [ ] T026 Perform one manual smoke for inbound voice transcription and one for outbound voice generation with LiteLLM env configured; capture outcomes in PR notes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: No dependencies
- **Phase 2**: Depends on Phase 1; blocks all user stories
- **Phases 3–5**: Depend on Phase 2
- **Phase 6**: Depends on completion of desired user stories

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2; no dependency on US2/US3
- **US2 (P2)**: Starts after Phase 2; independent from US1 except shared TTS defaults
- **US3 (P3)**: Starts after Phase 2; validates default/override behavior across US1 + US2 paths

### Parallel Opportunities

- T003, T006, T007 can run in parallel
- T008 and T009 can run in parallel
- T013 and T014 can run in parallel
- T018 and T019 can run in parallel
- T023 and T024 can run in parallel

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1 and Phase 2
2. Complete US1 tasks (T008–T012)
3. Validate transcription flow independently
4. Demo/deploy MVP if needed

### Incremental Delivery

1. Ship US1 (transcription)
2. Add US2 (voice generation)
3. Add US3 (default/override consistency hardening)
4. Finish polish and full verification

---

## Notes

- Keep task execution scoped to files listed to reduce merge conflicts.
- Prefer additive changes and preserve existing non-voice behavior by default.
- Keep error messages user-safe and avoid exposing secrets in logs or diagnostics.
