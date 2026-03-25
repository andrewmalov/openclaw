# Feature Specification: Fix: toolCall-only NO_REPLY messages cause orchestrator errors

|**Feature Branch**: `005-fix-toolcall-no-reply-orchestrator-error`
|**Created**: 2026-03-25
|**Status**: Draft
|**Input**: User description: "fix Issue https://github.com/andrewmalov/openclaw/issues/2 - Bug 2: toolCall-only messages treated as errors"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Drop toolCall-only assistant messages from chat.history (Priority: P1)

When an agent sends a file via `message(send, target=webchat, filePath=...)` and the Gateway stores a `NO_REPLY` assistant message containing only a `toolCall` block (no text, no media), the `chat.history` response must not include that message. This prevents the orchestrator from treating it as a "no reply" error.

**Why this priority**: This is the root cause of Bug 2. Without this fix, every file delivery via inline relay produces a false-positive "no reply" error in the orchestrator.

**Independent Test**: A test that creates an assistant message with only a `toolCall` content block (no text, no media), runs it through `sanitizeChatHistoryMessages`, and verifies the message is dropped.

**Acceptance Scenarios**:

1. **Given** an assistant message with `content: [{type: "toolCall", ...}]` and no `text` or `media` fields, **When** `sanitizeChatHistoryMessages` is called, **Then** the message is dropped from the result.

2. **Given** an assistant message with `content: [{type: "toolCall", ...}, {type: "text", ...}]` (mixed toolCall and text), **When** `sanitizeChatHistoryMessages` is called, **Then** the message is kept.

3. **Given** an assistant message with `content: [{type: "toolCall", ...}]` and `media: [...]` (toolCall with media), **When** `sanitizeChatHistoryMessages` is called, **Then** the message is kept (media takes precedence over dropping).

4. **Given** an assistant message with `content: [{type: "toolCall", ...}]` and a `text` field that is exactly `SILENT_REPLY_TOKEN`, **When** `sanitizeChatHistoryMessages` is called, **Then** the message is dropped (existing SILENT_REPLY_TOKEN behavior preserved).

---

### Edge Cases

- Messages with mixed `toolCall` and `text` content blocks are kept (they represent a meaningful response with a tool call).
- Messages with `toolCall` content blocks that also have `media` are kept (media indicates a real deliverable).
- Messages with `toolCall` content blocks that also have a non-empty `text` field are kept.
- Non-assistant messages (e.g., `tool` role) with `toolCall` content are kept as-is (they are not the source of this bug).
- Existing `NO_REPLY` token dropping behavior is unchanged for text-only messages.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The `sanitizeChatHistoryMessages` function MUST drop assistant messages where the `content` array contains **only** `toolCall` blocks (no `text` blocks) **and** the message has no `media` array.
- **FR-002**: Messages with mixed content (both `toolCall` and `text` blocks) MUST be kept.
- **FR-003**: Messages with `toolCall`-only content that also have a non-empty `text` field MUST be kept.
- **FR-004**: Messages with `toolCall`-only content that also have a `media` array with at least one item MUST be kept.
- **FR-005**: Non-assistant messages (e.g., `tool` role) with `toolCall` content MUST be kept (existing behavior unchanged).

### Key Entities _(include if feature involves data)_

- **Assistant message**: `{ role: "assistant", content: ContentBlock[], text?: string, media?: MediaItem[] }`
- **ContentBlock**: `{ type: "text", text: string }` or `{ type: "toolCall", id: string, name: string, arguments: object }`

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Orchestrator calling `chat.history` after `message(send, target=webchat, filePath=...)` with a toolCall-only NO_REPLY intermediate message receives a `chat.history` response where that message is absent (no false-positive "no reply" error shown to user).
- **SC-002**: Orchestrator receives `chat.history` responses where the last assistant message always has at least one of: non-empty `text`, non-empty `media` array, or mixed `content` (text + toolCall).
- **SC-003**: No regression: existing `sanitizeChatHistoryMessages` behavior for text-only NO_REPLY messages and tool-role messages is unchanged.
