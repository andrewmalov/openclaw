# Tasks: Fix: chat.history media field lost when history truncated

**Input**: Design documents from `/specs/004-fix-media-truncation/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Implementation

### User Story 1 - Media delivered via inlineRelay survives history truncation (Priority: P1)

**Goal**: `enforceChatHistoryFinalBudget` preserves `media[]` from the original last assistant message when creating a placeholder.

**Independent Test**: Create a mock messages array with a last assistant message containing `media[]`, set `maxBytes` to force placeholder creation, call `enforceChatHistoryFinalBudget`, assert the placeholder returned contains the original `media[]`.

### Tasks

- [x] T001 [US1] Read `buildOversizedHistoryPlaceholder` in `src/gateway/server-methods/chat.ts` to confirm current shape
- [x] T002 [US1] Read `enforceChatHistoryFinalBudget` in `src/gateway/server-methods/chat.ts` to confirm parameter shape and call site
- [x] T003 [US1] Read `chat.history` handler call site for `enforceChatHistoryFinalBudget` to confirm `rpcAttachments` config is available
- [x] T004 [US1] Modify `buildOversizedHistoryPlaceholder` to accept `outgoingMaxBytes: number` parameter and extract `media[]` from the original message, carrying it into the placeholder (with `content` dropped if it exceeds the limit, but `mimeType`/`fileName`/`type` preserved)
- [x] T005 [US1] Modify `enforceChatHistoryFinalBudget` to accept `outgoingMaxBytes: number` and pass it to `buildOversizedHistoryPlaceholder`
- [x] T006 [US1] Update `chat.history` handler call site to pass `rpcAttachments.outgoingPerAttachmentMaxBytes ?? GATEWAY_RPC_ATTACHMENT_DEFAULT_MAX_BYTES` to `enforceChatHistoryFinalBudget`

**Checkpoint**: `chat.history` now preserves `media[]` from the last assistant message even when `enforceChatHistoryFinalBudget` creates a placeholder.

---

## Phase 2: Regression Tests

**Goal**: Add tests for `buildOversizedHistoryPlaceholder` and `enforceChatHistoryFinalBudget` covering media preservation.

**Independent Test**: Run `pnpm test -- src/gateway/server-methods/chat.test.ts` and verify all new tests pass.

### Tasks

- [x] T007 [P] [US1] Create `src/gateway/server-methods/chat.test.ts` with test suite for `buildOversizedHistoryPlaceholder` and `enforceChatHistoryFinalBudget`
- [x] T008 [P] [US1] Add test: `buildOversizedHistoryPlaceholder` with message containing `media[]` returns placeholder with `media[]` (no content dropped)
- [x] T009 [P] [US1] Add test: `buildOversizedHistoryPlaceholder` with message containing `media[]` with oversized `content` returns placeholder with `media[]` without `content` but with `mimeType`/`fileName`/`type` preserved
- [x] T010 [P] [US1] Add test: `buildOversizedHistoryPlaceholder` with message without `media` returns placeholder without `media`
- [x] T011 [P] [US1] Add test: `enforceChatHistoryFinalBudget` — last message with `media[]` survives when no truncation needed
- [x] T012 [P] [US1] Add test: `enforceChatHistoryFinalBudget` — last message with `media[]` replaced by placeholder that still has `media[]`
- [x] T013 [P] [US1] Add test: `enforceChatHistoryFinalBudget` — last message with oversized `media[].content` replaced by placeholder with `media[]` (content omitted)
- [x] T014 [P] [US1] Run full test suite: `pnpm test -- src/gateway/server-methods/chat.test.ts` and fix any failures

**Checkpoint**: All new tests pass; no regressions in existing `chat.history` tests.

---

## Phase 3: Polish

### Tasks

- [x] T015 Run `pnpm check` (oxlint + oxfmt) on `src/gateway/server-methods/chat.ts` and fix any issues
- [x] T016 Run `pnpm tsgo` to verify TypeScript compilation passes
- [x] T017 Verify `pnpm test` passes (full suite, not just chat tests)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Implementation)**: No setup or foundational prerequisites — can start immediately
- **Phase 2 (Tests)**: Depends on Phase 1 implementation
- **Phase 3 (Polish)**: Depends on Phase 2 tests passing

### Within Each User Story

- Read existing functions before modifying
- Implement `buildOversizedHistoryPlaceholder` change first (T004)
- Implement `enforceChatHistoryFinalBudget` change (T005)
- Update call site (T006)
- Tests written after implementation (Phase 2)

### Parallel Opportunities

- T007–T013 are all independent test functions with no shared state and can run in parallel
- T008, T009, T010 test `buildOversizedHistoryPlaceholder` in parallel
- T011, T012, T013 test `enforceChatHistoryFinalBudget` in parallel
- T015 (lint) and T016 (tsc) can run in parallel after implementation

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Implementation
2. **STOP and VALIDATE**: Review `chat.history` output with a session where truncation occurs
3. Complete Phase 2: Tests
4. Run full test suite
5. Submit PR

### Incremental Delivery

1. Phase 1: Implement fix → verify logic
2. Phase 2: Write tests → verify regression coverage
3. Phase 3: Polish → ready to merge

---

## Notes

- **No setup phase needed**: This is a bug fix in existing code; no new project structure required.
- **No foundational phase needed**: Single-file change; no prerequisites.
- **Parallel test writing**: Tests T008–T010 and T011–T013 can be written in parallel since they test different functions.
- **Run lint/format checks** (T015) after every edit to catch issues early.
