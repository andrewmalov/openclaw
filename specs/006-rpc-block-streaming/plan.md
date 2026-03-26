# Implementation Plan: RPC Block Event Streaming for Orchestrators

**Branch**: `006-rpc-block-streaming` | **Date**: 2026-03-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-rpc-block-streaming/spec.md`

## Summary

Enable the Gateway to forward block events to RPC WebSocket clients (orchestrators) in real-time, so end users receive progressive text updates during long operations instead of a single delayed response. Currently, block events are only sent to direct Telegram sessions; orchestrators connecting via WebSocket RPC receive no intermediate updates.

## Technical Context

**Language/Version**: TypeScript (ESM), Node 22+
**Primary Dependencies**: Existing Gateway stack, WebSocket RPC protocol
**Storage**: Session transcripts (JSONL) under configured store path; no new persistence
**Testing**: Vitest with V8 coverage thresholds (colocated `*.test.ts`)
**Target Platform**: Gateway server (Node.js)
**Project Type**: Gateway RPC protocol extension
**Performance Goals**: Block events delivered within 500ms of Gateway receipt
**Constraints**: Backward compatibility with existing RPC clients that ignore events
**Scale/Scope**: Per-session WebSocket connections; events broadcast to all connected clients

## Constitution Check

Verify alignment with `.specify/memory/constitution.md`:

- **Project Vision (HOBOT)**: Feature fits the HOBOT architecture (orchestrator connects via WebSocket RPC, needs real-time block streaming).
- **I. Module and Structure**: Feature code under `src/gateway/`; no new root-level package deps.
- **II. CLI and Interface**: No new CLI surface; RPC protocol extension.
- **III. Test and Evidence**: Unit tests in `src/gateway/**/*.test.ts`; integration tests for event flow.
- **IV. Code Quality and Typing**: TypeScript strict; no prototype mutation; follow existing patterns.
- **V. PR Truthfulness and Triage**: Scope is accurate; no speculative fixes.

## Project Structure

### Source Code (repository root)

```text
src/
├── gateway/
│   ├── server/
│   │   ├── ws-connection/
│   │   │   └── message-handler.ts    # Existing: handles EventFrame forwarding
│   │   └── session-chat.ts           # New: emitBlockEvent() for RPC clients
│   ├── server-chat.ts                # Existing: emitChatDelta(), emitChatFinal()
│   ├── server-methods/
│   │   └── agent-job.ts              # Existing: agent lifecycle events
│   ├── protocol/
│   │   └── schema/
│   │       └── frames.ts             # Existing: RequestFrame, ResponseFrame, EventFrame
│   └── client.ts                     # Existing: GatewayClient WebSocket client
├── auto-reply/
│   └── reply/
│       └── block-streaming.ts        # Existing: chunking/coalescing config
└── agents/
    └── tools/
        └── message-tool.ts          # Existing: message tool with block handling

tests/
└── gateway/
    └── server/
        └── block-streaming-rpc.test.ts  # New: RPC block event tests
```

**Structure Decision**: Feature code lives in `src/gateway/server-chat.ts` (extend `emitChatDelta`/`emitChatFinal`) and new helper `src/gateway/server/session-chat.ts` for RPC-specific block event emission. Protocol extension adds new `chat.block` event type.

## Implementation Phases

### Phase 1: Protocol Extension

1. **Add `chat.block` event type** to `src/gateway/protocol/schema/frames.ts`:
   - New `EventFrame` payload structure for block events
   - Fields: `sessionKey`, `runId`, `block` (type, text, etc.), `isFinal`

2. **Create `src/gateway/server/session-chat.ts`**:
   - `emitBlockEvent()` function to broadcast block events to RPC clients
   - Reuses existing `broadcast()` mechanism from `server-chat.ts`

### Phase 2: Gateway Integration

3. **Modify `src/gateway/server-chat.ts`**:
   - In `createAgentEventHandler()`, after `emitChatDelta()`, call new `emitBlockEvent()` for RPC clients
   - Pass block data from `ChatHunks` or text stream events

4. **Respect existing config** in `src/auto-reply/reply/block-streaming.ts`:
   - Use `resolveBlockStreamingChunking()` and `resolveBlockStreamingCoalescing()` for event frequency
   - Block events should respect `blockStreamingDefault`, `blockStreamingBreak`, `blockStreamingChunk`, `blockStreamingCoalesce`

### Phase 3: Testing

5. **Add unit tests** in `tests/gateway/server/block-streaming-rpc.test.ts`:
   - Test `emitBlockEvent` broadcasts correct event structure
   - Test event respects block streaming config
   - Test backward compatibility (clients ignoring events continue to work)

6. **Add integration test** for full block streaming flow:
   - Mock RPC client connects to Gateway
   - Agent generates text with block streaming
   - Verify client receives `chat.block` events in real-time

## Complexity Tracking

> No violations. Feature follows existing Gateway patterns and extends rather than replaces.

## Open Questions / Risks

1. **Risk**: Block event frequency could overwhelm clients if agent generates blocks very rapidly (e.g., 100/second).
   - **Mitigation**: Respect `blockStreamingChunk` and `blockStreamingCoalesce` settings; add client-side throttling if needed.

2. **Risk**: Existing orchestrators that use `agent.wait` may double-process blocks (once via event, once via `chat.history`).
   - **Mitigation**: Document that orchestrators should ignore duplicate `chat.block` events or use `isFinal` to deduplicate.

3. **Risk**: Block events increase WebSocket message volume significantly.
   - **Mitigation**: Only forward events when `blockStreamingDefault: "on"` or session explicitly enables streaming.

## Dependencies

- `src/gateway/server-chat.ts` - existing chat event broadcast
- `src/gateway/protocol/schema/frames.ts` - existing frame types
- `src/auto-reply/reply/block-streaming.ts` - existing block streaming config
- `src/gateway/server-methods/agent-job.ts` - lifecycle event handling

## Files to Modify

1. `src/gateway/protocol/schema/frames.ts` - add `chat.block` event payload type
2. `src/gateway/server-chat.ts` - add `emitBlockEvent()` call in event handler
3. `src/gateway/server/session-chat.ts` - new file with `emitBlockEvent()` function

## Files to Create

1. `tests/gateway/server/block-streaming-rpc.test.ts` - unit and integration tests

## Out of Scope

- Changes to `agent.wait` API (events are additive)
- New `chat.subscribe` method (not needed; events arrive on existing WebSocket)
- Changes to block streaming config keys (reuse existing)
- Changes to channel-specific streaming (Telegram, etc. work as before)
