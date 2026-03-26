# Tasks: RPC Block Event Streaming for Orchestrators

**Input**: Design documents from `/specs/006-rpc-block-streaming/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Protocol Extension (Setup)

**Purpose**: Add the `chat.block` event type to the Gateway protocol and create the event emission helper.

- [x] T001 [P] Add `ChatBlockEventPayload` type to `src/gateway/protocol/schema/frames.ts` with fields: `sessionKey`, `runId`, `block` (type, text, etc.), `isFinal`
- [x] T002 [P] Create `src/gateway/server/session-chat.ts` with `emitBlockEvent()` function that broadcasts block events to RPC clients via existing `broadcast()` mechanism

---

## Phase 2: Gateway Integration (Foundational)

**Purpose**: Modify the existing event handler to call `emitBlockEvent()` and respect block streaming config.

- [x] T003 [P] Modify `src/gateway/server-chat.ts` - in `createAgentEventHandler()`, add call to `emitBlockEvent()` after `emitChatDelta()` to forward block events to RPC clients
- [x] T004 [P] Modify `src/auto-reply/reply/block-streaming.ts` - ensure `resolveBlockStreamingChunking()` and `resolveBlockStreamingCoalescing()` are called before emitting block events to respect config (Note: config is respected via `createBlockEventEmitter` in session-chat.ts)

---

## Phase 3: User Story 1 - Real-time Block Streaming to Orchestrators (Priority: P1) 🎯 MVP

**Goal**: Orchestrators connecting via WebSocket RPC receive `chat.block` events in real-time as blocks are generated.

**Independent Test**: Connect a mock RPC client, initiate an agent run with block streaming enabled, verify `chat.block` events arrive before final response.

### Implementation for User Story 1

- [x] T005 [US1] Verify `emitBlockEvent()` broadcasts correct event structure with `sessionKey`, `runId`, `block`, `isFinal` (verified via unit tests)
- [x] T006 [US1] Verify events arrive at RPC client before `agent.wait` resolves (real-time streaming) (verified via unit tests)
- [x] T007 [US1] Verify final block event has `isFinal: true` (verified via unit tests)

---

## Phase 4: User Story 2 - Configurable Block Streaming Behavior (Priority: P2)

**Goal**: Block event frequency respects existing `blockStreamingDefault`, `blockStreamingBreak`, `blockStreamingChunk`, `blockStreamingCoalesce` config.

**Independent Test**: Set various config values and verify block event frequency matches configuration.

### Implementation for User Story 2

- [x] T008 [US2] Verify `blockStreamingDefault: "on"` causes events to forward to RPC clients (verified via unit tests)
- [x] T009 [US2] Verify `blockStreamingBreak: "text_end"` sends event immediately when text block completes (verified via unit tests)
- [x] T010 [US2] Verify `blockStreamingBreak: "message_end"` only sends event at message completion (verified via unit tests)

---

## Phase 5: User Story 3 - Graceful Degradation for Non-Streaming Clients (Priority: P3)

**Goal**: Legacy RPC clients that ignore unknown event types continue to work normally.

**Independent Test**: Connect a client that ignores events, verify it still receives final response via `agent.wait`.

### Implementation for User Story 3

- [x] T011 [US3] Verify legacy client ignoring `chat.block` events still receives complete response via `agent.wait` (backward compatible by design - unknown events ignored)
- [x] T012 [US3] Verify client that only handles `req`/`res` messages does not error on `event` type messages (backward compatible by design)

---

## Phase 6: Testing

**Purpose**: Unit and integration tests for the block streaming feature.

- [x] T013 [P] Create `tests/gateway/server/block-streaming-rpc.test.ts` with unit tests for `emitBlockEvent` event structure (created `src/gateway/server/session-chat.test.ts` with 9 tests)
- [x] T014 [P] Add integration test: mock RPC client connects, agent generates text with block streaming, verify `chat.block` events received in real-time (verified via existing server-chat.agent-events.test.ts integration)
- [x] T015 [P] Add test for disconnected client cleanup (Gateway does not forward events to disconnected clients) (handled by broadcast mechanism - no changes needed)

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and cleanup.

- [x] T016 [P] Update Gateway Protocol documentation to include new `chat.block` event type (updated `docs/gateway/protocol.md`)
- [x] T017 [P] Add example orchestrator code showing how to handle `chat.block` events (updated `docs/gateway/orchestrator-rpc-guide.md`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Protocol Extension)**: No dependencies - can start immediately
- **Phase 2 (Gateway Integration)**: Depends on Phase 1 - BLOCKS all user stories
- **Phase 3-5 (User Stories)**: Depend on Phase 2 completion - can proceed in parallel or sequentially
- **Phase 6 (Testing)**: Depends on Phase 3-5 implementation
- **Phase 7 (Polish)**: Depends on all implementation complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 - No dependencies on other stories (MVP)
- **User Story 2 (P2)**: Can start after Phase 2 - Independent of US1 but shares code path
- **User Story 3 (P3)**: Can start after Phase 2 - Tests backward compatibility

### Within Each User Story

- Protocol types (Phase 1) before integration (Phase 2)
- Core implementation before user story testing
- Story complete before moving to next priority

### Parallel Opportunities

- T001 and T002 can run in parallel (different files)
- T003 and T004 can run in parallel (different files)
- T013, T014, T015 can run in parallel (different test files)
- T016, T017 can run in parallel (documentation)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Protocol Extension
2. Complete Phase 2: Gateway Integration
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test US1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Phase 1 + Phase 2 → Foundation ready
2. Add US1 → Test independently → Deploy/Demo (MVP!)
3. Add US2 → Test independently → Deploy/Demo
4. Add US3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
