# Feature Specification: Fix: chat.history media field lost when history truncated

**Feature Branch**: `004-fix-media-truncation`
**Created**: 2026-03-24
**Status**: Draft
**Input**: User description: "fix Issue https://github.com/andrewmalov/openclaw/issues/1"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Media delivered via inlineRelay survives history truncation (Priority: P1)

When an agent sends a file to webchat using `message(send, target=webchat, filePath=...)` and the session history grows large enough to trigger truncation, the `media` field must still be present in the final `chat.history` assistant message so the orchestrator can deliver the file to the user's channel (e.g., Telegram).

**Why this priority**: This is a data-integrity bug. Without media in `chat.history`, the orchestrator cannot deliver files to messaging channels, which is the core user-facing feature being broken.

**Independent Test**: A test that simulates a large session history that triggers `enforceChatHistoryFinalBudget`, injects `messagingToolSentMediaUrls` via `storeSessionRunMedia`, calls `chat.history`, and verifies the `media` field is present in the last assistant message.

**Acceptance Scenarios**:

1. **Given** a session with history large enough to trigger `enforceChatHistoryFinalBudget` truncation, **and** the last assistant message has no pending `messagingToolSentMediaUrls`, **When** the orchestrator calls `chat.history`, **Then** the response contains the last message (possibly a placeholder) without a `media` field.

2. **Given** a session with history large enough to trigger `enforceChatHistoryFinalBudget` truncation, **and** the last assistant message has `messagingToolSentMediaUrls` injected via `storeSessionRunMedia`, **When** the orchestrator calls `chat.history`, **Then** the response contains the last assistant message with the `media` field populated from the injected files (not a bare placeholder), **And** the `mediaUrl` files are base64-encoded and included in `media[]`.

3. **Given** a session where the last assistant message plus its `media` content exceeds `maxBytes` of `enforceChatHistoryFinalBudget`, **When** the orchestrator calls `chat.history`, **Then** a placeholder is returned that includes the `media` array (with `content` omitted if oversized, but `mimeType`/`fileName`/`type` preserved).

---

### Edge Cases

- The `media` field from the last assistant message is dropped if the message is a silent-reply token (`SILENT_REPLY_TOKEN`) and has no media — this behavior is preserved.
- If the file at `mediaUrl` cannot be read, the error is logged and the item is skipped; other media items are still injected.
- If multiple `chat.history` calls happen before truncation, media is only injected once (the store is cleared after injection).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The `chat.history` handler MUST preserve the `media` field from the **last assistant message** when `enforceChatHistoryFinalBudget` truncates older history.
- **FR-002**: When the last assistant message is replaced by an `__openclaw.truncated` placeholder due to byte-size limits, the placeholder MUST include the `media` array from the original last message (with `content` omitted if it would exceed the per-attachment size limit, but `mimeType`/`fileName`/`type` preserved).
- **FR-003**: The `injectMessageToolMediaIntoLastAssistantMessage` step MUST run **before** `enforceChatHistoryFinalBudget` so that pending `messagingToolSentMediaUrls` are already attached to the last message before truncation decisions are made.
- **FR-004**: The `enforceChatHistoryFinalBudget` function MUST extract and carry forward the `media` field from the original last message into the placeholder when a placeholder is created.

### Key Entities _(include if feature involves data)_

- **ChatHistoryMediaItem**: `type` ("image"|"file"), optional `mimeType`, optional `fileName`, optional `content` (base64).
- **SessionRunMedia store**: Holds `mediaUrls[]` for a session between the agent run completing and the next `chat.history` call.
- **Chat history placeholder**: `{ role, timestamp, content, __openclaw: { truncated: true, reason: "oversized" } }` — extended to carry `media[]`.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Orchestrator calling `chat.history` after `message(send, target=webchat, filePath=...)` receives `media_count > 0` in the response even when history was truncated by `enforceChatHistoryFinalBudget`.
- **SC-002**: When the last message is replaced by a placeholder due to size, the placeholder carries the original `media` array (with content omitted only if it would exceed the outgoing per-attachment byte limit).
- **SC-003**: No regression: sessions without pending `messagingToolSentMediaUrls` continue to return the same `chat.history` response shape as before.
