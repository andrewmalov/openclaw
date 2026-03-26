# Feature Specification: RPC Block Event Streaming for Orchestrators

**Feature Branch**: `006-rpc-block-streaming`
**Created**: 2026-03-25
**Status**: Draft
**Input**: User description: "новая фича стриминга сообщений, описание https://github.com/andrewmalov/openclaw/issues/3"

## User Scenarios & Testing

### User Story 1 - Real-time Block Streaming to Orchestrators (Priority: P1)

An orchestrator connects to the Gateway via WebSocket RPC, initiates an agent run, and receives block events as they are generated, enabling real-time streaming to end users (e.g., Telegram, webchat).

**Why this priority**: This is the core value proposition — enabling real-time streaming feedback during long operations. Without this, users see "Processing..." then the complete response at once.

**Independent Test**: Can be fully tested by connecting a mock RPC client, initiating an agent run with block streaming enabled, and verifying block events arrive at the client in real-time before the final response.

**Acceptance Scenarios**:

1. **Given** an orchestrator is connected to the Gateway via WebSocket RPC, **when** an agent generates text with block streaming enabled, **then** the orchestrator receives `chat.block` events with intermediate text as blocks are generated
2. **Given** an orchestrator connected to the Gateway, **when** a block event is received, **then** it contains the session key, run ID, block data, and `isFinal` flag indicating whether more blocks will follow
3. **Given** an orchestrator receiving block events, **when** the agent completes the response, **then** the final block event has `isFinal: true`

---

### User Story 2 - Configurable Block Streaming Behavior (Priority: P2)

Users or administrators can configure block streaming behavior via existing config keys, and the Gateway respects these settings when forwarding events to RPC clients.

**Why this priority**: Leverages existing configuration infrastructure to control streaming behavior without new APIs.

**Independent Test**: Can be tested by setting various `blockStreamingDefault`, `blockStreamingBreak`, and `blockStreamingChunk` values and verifying block event frequency matches configuration.

**Acceptance Scenarios**:

1. **Given** `blockStreamingDefault: "on"` is configured, **when** an agent run starts without explicit override, **then** block events are forwarded to RPC clients
2. **Given** `blockStreamingBreak: "text_end"` is configured, **when** a text block completes, **then** a block event is sent immediately
3. **Given** `blockStreamingBreak: "message_end"` is configured, **when** an agent run completes, **then** only the final message triggers a block event

---

### User Story 3 - Graceful Degradation for Non-Streaming Clients (Priority: P3)

RPC clients that do not implement block event handling continue to work normally by ignoring unknown event types.

**Why this priority**: Ensures backward compatibility with existing orchestrators that may not be upgraded immediately.

**Independent Test**: Can be tested by connecting a legacy RPC client that ignores events and verifying it still receives the final response via `agent.wait`.

**Acceptance Scenarios**:

1. **Given** a legacy RPC client that ignores events, **when** block events arrive, **then** the client continues to function and receives the final response via `agent.wait`
2. **Given** a client that only handles `req`/`res` messages, **when** `event` type messages arrive, **then** the client does not error and processes only the messages it understands

---

### Edge Cases

- What happens when block streaming is enabled but the RPC connection drops mid-stream? The Gateway should complete the agent run and not forward events to disconnected clients.
- How does the system handle very rapid block generation (e.g., 100 blocks per second)? The Gateway should respect `blockStreamingChunk` and `blockStreamingCoalesce` settings to avoid overwhelming clients.
- What happens when block events are enabled but the orchestrator uses `agent.wait` instead of event handling? The orchestrator should receive the complete response via `chat.history` after `agent.wait` resolves.

## Requirements

### Functional Requirements

- **FR-001**: The Gateway MUST forward block events to all WebSocket clients connected to a session when block streaming is enabled
- **FR-002**: Block events MUST contain the session key, run ID, block data, and `isFinal` flag
- **FR-003**: The Gateway MUST respect existing `blockStreamingDefault`, `blockStreamingBreak`, `blockStreamingChunk`, and `blockStreamingCoalesce` config keys when forwarding events
- **FR-004**: RPC clients that do not handle block events MUST continue to function normally (backward compatibility)
- **FR-005**: The Gateway MUST NOT forward block events to clients that have disconnected from the session
- **FR-006**: Block event forwarding MUST be independent of the channel (works for all channels that support block streaming)

### Key Entities

- **Block Event**: A real-time update containing a fragment of the agent's response (text, image, tool call, etc.)
- **RPC Session**: A WebSocket connection between an orchestrator and the Gateway for a specific agent session
- **Session Key**: A unique identifier for an agent session (e.g., `agent:main:main`)
- **Run ID**: A unique identifier for a specific agent run within a session

## Success Criteria

### Measurable Outcomes

- **SC-001**: Orchestrators receive block events within 500ms of the Gateway receiving them from the Pi runtime
- **SC-002**: Block event frequency matches the configured `blockStreamingBreak` and `blockStreamingChunk` settings
- **SC-003**: Existing RPC clients that ignore events continue to receive complete responses via `agent.wait` without modification
- **SC-004**: Users connected through orchestrators see progressive text updates during long operations instead of a single delayed response
- **SC-005**: The feature works for all supported messaging channels (Telegram, webchat, etc.) when accessed through an orchestrator
