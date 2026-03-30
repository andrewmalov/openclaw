# Data Model: LiteLLM Voice Messages

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## 1) Voice Input Message

Represents an inbound media attachment selected for audio understanding.

| Field             | Type   | Description                                               | Validation                          |
| ----------------- | ------ | --------------------------------------------------------- | ----------------------------------- |
| `attachmentIndex` | number | Position of selected attachment in inbound message        | Must refer to existing attachment   |
| `mime`            | string | Declared/derived media type                               | Must be supported by audio pipeline |
| `pathOrUrl`       | string | Resolved media source                                     | Must be accessible by runtime       |
| `scopeDecision`   | enum   | Whether media understanding is allowed in current context | Must be `allow` before processing   |

## 2) Recognized Transcript

Normalized transcription output passed into assistant turn context.

| Field      | Type   | Description                                        | Validation                                           |
| ---------- | ------ | -------------------------------------------------- | ---------------------------------------------------- |
| `text`     | string | Recognized speech text                             | Non-empty trimmed text                               |
| `provider` | string | Effective provider id                              | Expected `litellm` when LiteLLM path selected        |
| `model`    | string | Effective model id                                 | Defaults to `gpt-4o-audio-preview` if not overridden |
| `outcome`  | enum   | Processing result (`success`, `failed`, `skipped`) | Required                                             |

## 3) Voice Output Message

Generated audio reply artifact created from assistant text.

| Field             | Type    | Description                                  | Validation                              |
| ----------------- | ------- | -------------------------------------------- | --------------------------------------- |
| `textSource`      | string  | Text used for synthesis                      | Must pass current TTS max-length policy |
| `outputFormat`    | string  | Requested audio format (`opus`, `mp3`, etc.) | Must be channel-compatible              |
| `mediaPath`       | string  | Temporary path for generated audio file      | Must exist before message dispatch      |
| `voiceCompatible` | boolean | Whether output can be rendered as voice note | Required                                |

## 4) Audio Model Selection

Resolved model configuration for a single voice operation.

| Field           | Type   | Description                         | Validation                                    |
| --------------- | ------ | ----------------------------------- | --------------------------------------------- |
| `operation`     | enum   | `transcription` or `generation`     | Required                                      |
| `selectedModel` | string | Model used for request              | Defaults to `gpt-4o-audio-preview` when unset |
| `source`        | enum   | `default`, `config`, or `directive` | Required                                      |
| `baseUrlSource` | enum   | `env`, `config`, or `default`       | Required                                      |

## 5) Voice Processing Result

Operational outcome used for user messaging and diagnostics.

| Field         | Type   | Description                                | Validation                   |
| ------------- | ------ | ------------------------------------------ | ---------------------------- |
| `stage`       | enum   | `recognition`, `generation`, or `delivery` | Required                     |
| `status`      | enum   | `success` or `failure`                     | Required                     |
| `reasonCode`  | string | Normalized failure category                | Required for failures        |
| `userMessage` | string | User-safe status/fallback message          | Must be present for failures |

## State transitions

1. Inbound message received -> attachment policy selects audio candidate.
2. Audio candidate -> transcription request with resolved model and LiteLLM credentials.
3. Transcript success -> transcript merged into assistant turn context.
4. Assistant response text -> TTS synthesis request with resolved model/base URL.
5. Audio file generated -> channel delivery as media/voice note.
6. Any failure stage -> fallback text behavior + diagnostics.

## Relationships

- `Voice Input Message` produces one `Recognized Transcript` per processed attachment.
- A turn with `Recognized Transcript` may produce one `Voice Output Message` if voice output is requested/enabled.
- Every transcription/generation attempt has one `Audio Model Selection` and one `Voice Processing Result`.
