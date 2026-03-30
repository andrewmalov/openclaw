# Feature Specification: LiteLLM Voice Messages

**Feature Branch**: `008-litellm-voice-messages`  
**Created**: 2026-03-30  
**Status**: Draft  
**Input**: User description: "поддержка распознавания и генерации голосовых сообщений через litellm. модель по умолчанию gpt-4o-audio-preview"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Convert voice message to text reply (Priority: P1)

As a chat user, I can send a voice message and receive an accurate text response so I can communicate hands-free without losing understanding.

**Why this priority**: Voice-to-text is the core user value and unlocks immediate use for users who prefer speaking over typing.

**Independent Test**: Send a supported voice message in a conversation and confirm the assistant processes the audio and returns a coherent text reply without manual transcription.

**Acceptance Scenarios**:

1. **Given** a user is in an active chat session, **When** the user sends a supported voice message, **Then** the assistant returns a text response based on recognized speech content.
2. **Given** a voice message with short pauses or natural filler words, **When** the message is processed, **Then** the returned text response preserves the intended meaning of the spoken request.

---

### User Story 2 - Receive spoken assistant response (Priority: P2)

As a chat user, I can request a voice reply and receive an audio response so I can listen instead of reading.

**Why this priority**: Audio output is high-value for accessibility and on-the-go usage, but can be introduced after reliable speech recognition.

**Independent Test**: Ask the assistant for a spoken response and verify the returned message includes a playable audio attachment with intelligible speech matching the response content.

**Acceptance Scenarios**:

1. **Given** a user requests a spoken answer, **When** the assistant completes the response, **Then** the user receives a playable voice message in the same conversation.
2. **Given** the assistant creates a voice response, **When** the user plays it back, **Then** the spoken content matches the meaning of the assistant's textual answer.

---

### User Story 3 - Predictable default audio model behavior (Priority: P3)

As an operator, I want a sensible default audio-capable model so voice features work out of the box without additional setup.

**Why this priority**: Default behavior reduces setup friction and support burden after core voice interactions are available.

**Independent Test**: Run voice recognition and voice generation in a clean configuration and verify both use the default model when no override is provided.

**Acceptance Scenarios**:

1. **Given** no custom audio model is configured, **When** a voice recognition or voice generation request is sent, **Then** the system uses `gpt-4o-audio-preview` as the default model.
2. **Given** a custom model is configured, **When** a voice request is processed, **Then** the configured model is used instead of the default.

### Edge Cases

- User uploads an unsupported or corrupted audio file; the system returns a clear failure message and no partial or misleading answer.
- Audio exceeds configured size or duration limits; the system explains the limit and prompts the user to retry with a shorter message.
- Provider is reachable but audio capability is unavailable for the selected model; the system reports the capability mismatch and suggests retrying with a supported model.
- Voice generation succeeds but delivery fails on the channel; the system provides a fallback text response and indicates audio delivery could not be completed.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST accept supported user voice message inputs and process them through the configured LiteLLM provider path.
- **FR-002**: The system MUST recognize spoken content from accepted voice inputs and make that recognized content available to the assistant turn.
- **FR-003**: Users MUST be able to request spoken assistant replies and receive a playable voice message in-channel when generation succeeds.
- **FR-004**: The system MUST default audio recognition and audio generation requests to model `gpt-4o-audio-preview` when no audio model override is configured.
- **FR-005**: The system MUST allow operators to override the default audio model through existing configuration mechanisms.
- **FR-006**: The system MUST return user-friendly error messages for unsupported input formats, recognition failures, generation failures, and delivery failures.
- **FR-007**: The system MUST preserve existing non-voice messaging behavior when voice features are disabled, unavailable, or fail.
- **FR-008**: The system MUST capture enough request outcome information for operators to diagnose why a voice request succeeded or failed.

### Key Entities _(include if feature involves data)_

- **Voice Input Message**: A user-submitted audio message for assistant processing, including channel context, media metadata, and processing eligibility.
- **Recognized Transcript**: The textual interpretation of a voice input used as assistant-turn input.
- **Voice Output Message**: A generated assistant audio reply bound to a conversation turn and delivery channel.
- **Audio Model Selection**: Resolution state describing which model is used for a voice request (default or operator override).
- **Voice Processing Result**: Outcome record for recognition or generation attempts, including status, failure reason category, and user-visible message.

## Assumptions

- Existing channels that already support media attachments remain the initial scope for voice input and output.
- Existing permissions and session rules for standard messages apply equally to voice messages.
- Default limits for message size and media handling remain governed by current platform constraints unless explicitly overridden elsewhere.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In validation runs with supported audio samples, at least 95% of voice inputs complete recognition and produce a usable assistant response.
- **SC-002**: At least 95% of successful voice-generation requests produce a playable audio message in the originating conversation.
- **SC-003**: In operator acceptance testing with a clean setup, 100% of voice recognition and generation requests use the documented default model when no override is configured.
- **SC-004**: For voice requests that fail, 100% of user-visible failures include a clear reason and a concrete next-step hint (for example retry, shorten audio, or choose a supported model).
