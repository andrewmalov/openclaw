# Tasks: Fix: toolCall-only NO_REPLY messages cause orchestrator errors

**Input**: Design documents from `/specs/005-fix-toolcall-no-reply-orchestrator-error/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Implementation

### User Story 1 - Drop toolCall-only assistant messages from chat.history (Priority: P1)

**Goal**: Modify `extractAssistantTextForSilentCheck` to detect toolCall-only messages and return `SILENT_REPLY_TOKEN` so they are dropped by `sanitizeChatHistoryMessages`.

**Independent Test**: Create test with assistant message containing only toolCall content block (no text, no media), call `sanitizeChatHistoryMessages`, assert the message is dropped.

### Tasks

- [x] T001 [US1] Read `extractAssistantTextForSilentCheck` in `src/gateway/server-methods/chat.ts` to understand current behavior
- [x] T002 [US1] Read `sanitizeChatHistoryMessages` to confirm the silent-token dropping logic
- [x] T003 [US1] Modify `extractAssistantTextForSilentCheck` to detect toolCall-only messages and return `SILENT_REPLY_TOKEN`
- [x] T004 [US1] Export `extractAssistantTextForSilentCheck` and `sanitizeChatHistoryMessages` for testing
- [x] T005 [US1] Run `pnpm check` (oxlint + oxfmt) on `src/gateway/server-methods/chat.ts` and fix any issues

**Checkpoint**: `extractAssistantTextForSilentCheck` returns `SILENT_REPLY_TOKEN` for toolCall-only messages, `undefined` for mixed content.

---

## Phase 2: Regression Tests

**Goal**: Add tests for toolCall-only NO_REPLY behavior in `sanitizeChatHistoryMessages`.

**Independent Test**: Run `pnpm test -- src/gateway/server-methods/chat.test.ts` and verify all new tests pass.

### Tasks

- [x] T006 [P] [US1] Create tests for `extractAssistantTextForSilentCheck` covering toolCall-only, mixed, and other content types
- [x] T007 [P] [US1] Add test: toolCall-only assistant message with no media is dropped
- [x] T008 [P] [US1] Add test: toolCall-only assistant message with media is kept
- [x] T009 [P] [US1] Add test: mixed toolCall + text content is kept
- [x] T010 [P] [US1] Add test: non-assistant messages with toolCall content are kept
- [x] T011 [P] [US1] Add test: toolCall-only with text field that is NO_REPLY is dropped
- [x] T012 [P] [US1] Add test: toolCall-only with non-empty text field is kept
- [x] T013 [P] [US1] Add test: multiple consecutive toolCall-only messages are all dropped
- [x] T014 [US1] Run full test suite: `pnpm test -- src/gateway/server-methods/chat.test.ts` and fix any failures

**Checkpoint**: All new tests pass; no regressions in existing tests.

---

## Phase 3: Polish

### Tasks

- [x] T015 Run `pnpm check` (oxlint + oxfmt) on `src/gateway/server-methods/chat.ts` and fix any issues
- [x] T016 Run `pnpm test -- src/gateway/server-methods/chat.test.ts` to verify all tests pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Implementation)**: No prerequisites — can start immediately
- **Phase 2 (Tests)**: Depends on Phase 1 implementation (T003 and T004 must be done first)
- **Phase 3 (Polish)**: Depends on Phase 2 tests passing

### Within Each User Story

- Read existing functions before modifying
- Implement fix in `extractAssistantTextForSilentCheck` (T003)
- Export functions for testing (T004)
- Tests written after implementation (Phase 2)

### Parallel Opportunities

- T006–T013 are all independent test cases and can run in parallel
- T015 (lint) can run in parallel with T016 (test)

---

## Implementation Strategy

### Single-Phase Fix

1. Complete Phase 1: Implement fix in `extractAssistantTextForSilentCheck`
2. Complete Phase 2: Write tests
3. Run full test suite
4. Submit PR

### Summary of Changes

**`src/gateway/server-methods/chat.ts`**:

- Modified `extractAssistantTextForSilentCheck` to detect toolCall-only messages (content array has only `toolCall` blocks, no `text` blocks) and return `SILENT_REPLY_TOKEN` so they get dropped as NO_REPLY messages.
- Exported `extractAssistantTextForSilentCheck` and `sanitizeChatHistoryMessages` for testing.

**`src/gateway/server-methods/chat.test.ts`**:

- Added import for `sanitizeChatHistoryMessages` and `extractAssistantTextForSilentCheck`.
- Added test suite covering all Bug 2 acceptance scenarios.

---

## Notes

- **Bug 2 fix**: ToolCall-only NO_REPLY messages are now dropped from `chat.history`, preventing orchestrator false-positive "no reply" errors.
- The existing `sanitizeChatHistoryMessages` function already drops messages where `extractAssistantTextForSilentCheck` returns `SILENT_REPLY_TOKEN`, so the fix only needed to change what `extractAssistantTextForSilentCheck` returns for toolCall-only messages.
- Mixed content (text + toolCall) still returns the text, which means the message is kept — this is the correct behavior since a real reply exists.
- Pre-existing TypeScript errors in `src/gateway/server.agent.gateway-server-agent-a.test.ts`, `src/gateway/server.chat.gateway-server-chat.test.ts`, and `src/media-understanding/runner.ts` are not related to this change.
