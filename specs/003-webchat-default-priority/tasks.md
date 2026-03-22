---
description: "Task list for 003-webchat-default-priority (orchestrator webchat channel default + files)"
---

# Tasks: Webchat default channel for orchestrator agent

**Input**: Design documents from `specs/003-webchat-default-priority/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/webchat-channel-selection.md](./contracts/webchat-channel-selection.md), [quickstart.md](./quickstart.md)

**Tests**: Included — plan and constitution call for Vitest regression coverage (`channel-selection`, message runner webchat/media).

**Organization**: Phases follow user story priorities (P1 → P3) after shared foundation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no ordering dependency)
- **[Story]**: User story label (US1, US2, US3)
- Paths are repo-root relative

## Path Conventions

Single monorepo core: `src/` with colocated `*.test.ts`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Align on artifacts and current code paths before edits

- [x] T001 [P] Read acceptance criteria in specs/003-webchat-default-priority/spec.md and invariants in specs/003-webchat-default-priority/contracts/webchat-channel-selection.md
- [x] T002 [P] Skim current selection and relay logic in src/infra/outbound/channel-selection.ts and src/infra/outbound/message-action-runner.ts (webchat / INTERNAL_MESSAGE_CHANNEL branches)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Channel resolution must yield `webchat` for webchat tool context before any user-story verification

**⚠️ CRITICAL**: Complete this phase before Phases 3–5

- [x] T003 [P] Add Vitest regression cases in src/infra/outbound/channel-selection.test.ts: `fallbackChannel=webchat` + zero configured external channels must not throw “Channel is required (no configured channels detected)” (expect red until T004)
- [x] T004 Implement webchat fallback in src/infra/outbound/channel-selection.ts so `resolveMessageChannelSelection` accepts `INTERNAL_MESSAGE_CHANNEL` / `webchat` from `fallbackChannel` without requiring plugin-backed configured channels
- [x] T005 Align TypeScript types and any call-site assumptions in src/infra/outbound/message-action-runner.ts, src/infra/outbound/message-action-normalization.ts, and related imports if `resolveMessageChannelSelection` return type widens to include webchat

**Checkpoint**: `pnpm test -- src/infra/outbound/channel-selection.test.ts` passes; foundation unblocks user stories

---

## Phase 3: User Story 1 — Deliver files through webchat (Priority: P1) 🎯 MVP

**Goal**: Operator receives files in the same webchat session with no spurious channel errors (spec FR-002, FR-003)

**Independent Test**: Webchat-only config + agent `message` send with media targeting webchat completes without channel-selection failure; see specs/003-webchat-default-priority/quickstart.md

### Tests for User Story 1

- [x] T006 [P] [US1] Extend Vitest coverage in src/infra/outbound/message-action-runner.media.test.ts (or add focused cases) for `runMessageAction` with `toolContext.currentChannelProvider=webchat`, media path, and `target`/`to` webchat inline relay expectations

### Implementation for User Story 1

- [x] T007 [US1] Verify and, if needed, adjust src/infra/outbound/message-action-runner.ts so inline relay for webchat runs after successful `resolveChannel` with channel `webchat` (no behavior regression for external channels)
- [x] T008 [US1] Update `message` tool description and/or schema hints in src/agents/tools/message-tool.ts for webchat-originated sessions: steer models toward `target=webchat` (or equivalent) and media/`path` fields for file handoff

**Checkpoint**: US1 scenarios in spec.md acceptance 1–2 verifiable via tests + manual quickstart

---

## Phase 4: User Story 2 — Webchat default surface (Priority: P2)

**Goal**: Orchestrator webchat is the implicit default for “reply here” style outbound tool use (spec FR-001); no failure solely due to missing external connectors (spec FR-003)

**Independent Test**: Prompts that previously ended in channel-required class errors now default to webchat context when `currentChannelProvider` is webchat

### Implementation for User Story 2

- [x] T009 [US2] Trace `currentChannelProvider` / webchat propagation into `createMessageTool` options in src/agents/openclaw-tools.ts and gateway/pi-embedded wiring under src/gateway/ and src/agents/pi-embedded-runner/; fix gaps if webchat context is dropped before the message tool runs
- [x] T010 [US2] Refine copy in src/agents/tools/message-tool.ts so operators/models use normal assistant replies for plain text in webchat while reserving the tool for attachments and cross-surface sends (consistent with existing text-only guard in src/infra/outbound/message-action-runner.ts)

**Checkpoint**: US2 acceptance scenarios in spec.md hold without new channel-configuration errors

---

## Phase 5: User Story 3 — Explicit external surface (Priority: P3)

**Goal**: When external channels exist, explicit `channel` in tool args still wins; when omitted, webchat remains default for webchat-originated sessions (spec FR-004, contract INV-2/INV-3)

**Independent Test**: Fixture config with 2+ external channels + webchat tool context + no explicit channel → resolved channel is webchat; with explicit `channel=telegram` (or configured plugin) → that channel wins

### Tests for User Story 3

- [x] T011 [P] [US3] Add Vitest cases in src/infra/outbound/channel-selection.test.ts for multiple configured external channels plus `fallbackChannel=webchat` and no explicit `channel` param → expect `webchat`

### Implementation for User Story 3

- [x] T012 [US3] Extend src/infra/outbound/channel-selection.ts if T011 reveals gaps versus specs/003-webchat-default-priority/contracts/webchat-channel-selection.md INV-3 (explicit `channel` param must still override fallback)

**Checkpoint**: US3 acceptance scenarios in spec.md and contract invariants satisfied

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates and documentation drift

- [x] T013 [P] Run `pnpm check` and `pnpm test` from repo root; fix any failures introduced in touched paths
- [x] T014 [P] Update specs/003-webchat-default-priority/quickstart.md if verification commands or file paths changed during implementation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: No dependencies — start immediately
- **Phase 2**: Depends on Phase 1 — **blocks** Phases 3–5
- **Phases 3–5**: Depend on Phase 2; US2/US3 assume US1 core selection fix (T004) is done
- **Phase 6**: After desired user stories complete

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 only for MVP
- **US2 (P2)**: Depends on Phase 2; builds on US1 behavior (same selection + wiring)
- **US3 (P3)**: Depends on Phase 2; refines multi-channel vs webchat default (may adjust T004 behavior)

### Within Each User Story

- US1: T006 tests can start after Phase 2; T007–T008 follow or parallelize T006 with T007 if coordinated
- US3: T011 before or in lockstep with T012

### Parallel Opportunities

- T001 ∥ T002 (Phase 1)
- T003 can be authored while T002 reads code (different concern: test vs read)
- T006 ∥ T011 if staffed separately (different story phases after Phase 2 — note T011 should follow T004)
- T013 ∥ T014 (Phase 6)

---

## Parallel Example: User Story 1

```bash
# After Phase 2 completes, run in parallel where possible:
# Developer A: T006 — extend src/infra/outbound/message-action-runner.media.test.ts
# Developer B: T008 — edit src/agents/tools/message-tool.ts (coordinate on shared behavior with A)
```

---

## Parallel Example: User Story 3

```bash
# T011 — add cases in src/infra/outbound/channel-selection.test.ts
# Then T012 — adjust src/infra/outbound/channel-selection.ts until T011 passes
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1 and Phase 2 (T001–T005)
2. Complete Phase 3 (T006–T008)
3. Stop and run quickstart manual scenario + tests
4. Demo/deploy when green

### Incremental Delivery

1. Foundation (Phase 2) → channel errors eliminated for webchat context
2. US1 → file handoff path validated
3. US2 → wiring + copy for default surface
4. US3 → multi-channel priority rules
5. Phase 6 → full suite + doc touch-up

### Parallel Team Strategy

- After Phase 2: one developer on US1 (runner + tool copy), another on US2 (propagation trace), merge before US3 selection tweaks if conflicts arise

---

## Notes

- Coordinate with `specs/001-gateway-rpc-file-transfer` if `chat.history` media is still empty after this work (plan.md Summary)
- Use `scripts/committer "<msg>" <files...>` per constitution for commits
- Avoid vague tasks; each item names concrete files

---

## Summary (for /speckit.report)

| Metric            | Value                                                         |
| ----------------- | ------------------------------------------------------------- |
| Total tasks       | 14                                                            |
| Phase 1           | 2                                                             |
| Phase 2           | 3                                                             |
| US1               | 3                                                             |
| US2               | 2                                                             |
| US3               | 2                                                             |
| Polish            | 2                                                             |
| Parallel-friendly | T001, T002, T003, T006, T011, T013, T014 (with caveats above) |

**Suggested MVP**: Phases 1–3 (T001–T008)

**Format validation**: All tasks use `- [ ] Tnnn` with file paths in the description; story labels only on US phases.
