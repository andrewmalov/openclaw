# Tasks: Gateway RPC Arbitrary File Transfer

**Input**: Design documents from `specs/001-gateway-rpc-file-transfer/`  
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included per story (colocated `*.test.ts` per plan; regression and new behavior).

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- Gateway and media: `src/gateway/`, `src/media/` at repository root (per plan.md)

---

## Phase 1: Setup (Config & Schema)

**Purpose**: Add configuration and protocol schema for attachment limits and MIME policy so all later phases can depend on them.

- [x] T001 Add Gateway config schema for per-attachment size limit (incoming default 100 MB) and optional aggregate size / max count in `src/config/` (or gateway config schema location)
- [x] T002 [P] Add config keys for optional MIME allowlist/blocklist for incoming attachments in gateway config
- [x] T003 [P] Extend protocol schema for agent and chat.send params to allow attachmentRefs array in `src/gateway/protocol/schema/` (agent.ts, logs-chat or chat schema)

**Checkpoint**: Config and schema ready for validation and handlers

---

## Phase 2: Foundational (Attachment Validation & Agent Delivery Shape)

**Purpose**: Shared validation and parsing that US1 (and later US3) depend on. No user story can ship without this.

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete.

- [x] T004 In `src/gateway/chat-attachments.ts`: make maxBytes configurable (default 100 MB), stop dropping non-image attachments; accept MIME per Telegram-aligned policy (remove or gate requireImageMime / non-image drop)
- [x] T005 In `src/gateway/chat-attachments.ts`: extend parseMessageWithAttachments (or add parallel path) to return a unified attachments list (image + non-image) with type, mimeType, fileName, data/path so agent receives one format
- [x] T006 In `src/gateway/chat-attachments.ts`: ensure validation errors include reason (size exceeded, invalid base64, type not allowed) and are returned to RPC client
- [x] T007 Add unit tests in `src/gateway/chat-attachments.test.ts` for non-image MIME acceptance, configurable maxBytes, and validation error reasons

**Checkpoint**: Foundation ready — user story implementation can begin

---

## Phase 3: User Story 1 – Send Arbitrary Files from Client to Agent (Priority: P1) – MVP

**Goal**: Client can send non-image attachments (e.g. PDF) via agent and chat.send; Gateway accepts them and agent receives them in the unified format. Size and MIME validation with clear errors.

**Independent Test**: Send a non-image attachment (e.g. PDF) via RPC; verify it is not dropped and is delivered to the agent in the agreed format. Repeat with different MIME types within limits. Send an over-size attachment and verify error reason.

### Implementation for User Story 1

- [x] T008 [US1] In `src/gateway/server-methods/agent.ts`: pass configurable maxBytes (from config) into attachment parsing; use extended parseMessageWithAttachments (or new validator) and pass unified attachments (image + non-image) to agent pipeline
- [x] T009 [US1] In `src/gateway/server-methods/chat.ts` (chat.send): pass configurable maxBytes into attachment parsing; use same unified attachment format and return validation errors with reason on failure
- [x] T010 [US1] Wire agent pipeline (e.g. buildAgentPrompt or equivalent in `src/gateway/`) to consume unified attachments list for both images and non-image (model/tools format as per existing patterns)
- [x] T011 [US1] Add or extend tests in `src/gateway/server.agent.gateway-server-agent-a.test.ts` for non-image attachment (e.g. PDF) accepted and delivered to agent
- [x] T012 [US1] Add or extend tests in `src/gateway/server-methods/chat.test.ts` or `src/gateway/server.chat.gateway-server-chat*.test.ts` for chat.send with non-image attachment and for size-limit error with reason

**Checkpoint**: User Story 1 complete — client can send arbitrary files to agent; tests pass

---

## Phase 4: User Story 2 – Receive Files from Agent in History (Priority: P1)

**Goal**: chat.history returns assistant messages with optional `media` array (type, mimeType, fileName, content base64). Reply text is Telegram-HTML compatible. Existing messages without media unchanged.

**Independent Test**: Have the agent produce a file; request chat.history; verify message includes media with content (base64). Verify existing clients (no media) see unchanged behavior.

### Implementation for User Story 2

- [x] T013 [US2] Define response shape for assistant messages in chat.history: `text` (string), `media?` (array of { type, mimeType?, fileName?, content? }) in `src/gateway/server-methods/chat.ts` and/or types used by session-utils/response builder
- [x] T014 [US2] When building chat.history response in `src/gateway/server-methods/chat.ts`: enrich messages from transcript/completion so that when agent produced files, read local files (or reply payload) and set media[].content (base64); keep text and media separate
- [x] T015 [US2] Ensure reply text in chat.history uses Telegram-HTML compatible format (align with `src/telegram/format.ts` or document format in contract) in `src/gateway/server-methods/chat.ts` or reply builder
- [x] T016 [US2] Add config for outgoing inline per-attachment size limit (default 100 MB) and optional aggregate/count; enforce when building media in response
- [x] T017 [US2] Add tests in `src/gateway/server-methods/chat.test.ts` or `src/gateway/server.chat.gateway-server-chat*.test.ts` for chat.history returning messages with media (content base64) and for messages without media (unchanged shape)

### Message tool inline relay → chat.history media (gap)

**Goal**: When the agent uses `message(send, target=webchat, filePath=...)`, the inline relay returns `mediaUrl` in the tool result; this must reach `chat.history.media` so the orchestrator receives the file inline.

**Independent Test**: Agent calls message tool with target=webchat and filePath; request chat.history; verify the last assistant message includes media with content (base64) from that file.

- [x] T017a [US2] In `src/agents/pi-embedded-subscribe.handlers.tools.ts`: extend `collectMessagingMediaUrlsFromRecord` (or `collectMessagingMediaUrlsFromToolResult`) to extract `mediaUrl`/`mediaUrls` from `sendResult` when present, so message tool inline relay result (with `sendResult: { mediaUrl, mediaUrls }`) populates `messagingToolSentMediaUrls`
- [x] T017b [US2] Persist `messagingToolSentMediaUrls` for completed runs so chat.history can read them: extend transcript format or add run metadata store (e.g. session sidecar or in-memory cache keyed by runId) in `src/gateway/` or `src/config/sessions/`; write when run completes
- [x] T017c [US2] In `src/gateway/server-methods/chat.ts`: when building chat.history, load persisted messagingToolSentMediaUrls for the session’s recent run(s); in `enrichAssistantMessagesWithTextAndMedia` (or a new helper), for the last assistant message, read files at those paths, base64-encode, and append to `media[]`; respect `outgoingPerAttachmentMaxBytes`
- [x] T017d [US2] Add test in `src/gateway/server.chat.gateway-server-chat*.test.ts` for message tool with target=webchat + filePath producing media in chat.history

**Checkpoint**: User Story 2 complete — orchestrator receives files inline in chat.history (including from message tool)

---

## Phase 5: User Story 4 – Backward Compatibility and Contract Documentation (Priority: P1)

**Goal**: Clients that do not send new fields and do not expect media continue to work. Contract and limits documented.

**Independent Test**: Run existing client flows without attachments/media; verify behavior unchanged. Verify documentation exists for attachments, attachmentRefs, limits, history media format.

### Implementation for User Story 4

- [x] T018 [US4] Add regression tests (or extend existing) in `src/gateway/` for agent and chat.send without attachments and chat.history without reading media to ensure response shape and behavior unchanged
- [x] T019 [US4] Update `specs/001-gateway-rpc-file-transfer/contracts/gateway-rpc-attachments.md` with final limits, MIME policy, and config keys; add deployment note for proxy/WebSocket message size (100 MB)
- [x] T020 [US4] Add or update docs (e.g. `docs/gateway/` or repo docs) linking to contract: attachment/attachmentRefs formats, chat.history message shape with media, reply text format (Telegram-HTML)

**Checkpoint**: Backward compatibility verified; contract and docs published

---

## Phase 6: User Story 3 – Send Files by Reference (URL) (Priority: P2)

**Goal**: Client can send attachmentRefs (HTTPS URL); Gateway fetches with size/timeout/redirect limits and passes content to agent in same format as inline attachments.

**Independent Test**: Send attachmentRefs with valid HTTPS URL; verify agent receives file. Send invalid scheme or over-size URL; verify clear validation error.

### Implementation for User Story 3

- [ ] T021 [US3] Add params validation for attachmentRefs (url required, optional mimeType, fileName) in `src/gateway/server-methods/agent.ts` and protocol schema
- [ ] T022 [US3] Implement Gateway-side fetch for attachmentRefs in `src/gateway/` (or use `src/web/media` with bounded buffer): HTTPS only (or configurable allowlist), configurable max size, timeout, redirect limits; no sensitive data in logs
- [ ] T023 [US3] In `src/gateway/server-methods/agent.ts`: resolve attachmentRefs before agent run, merge fetched content into unified attachments list and pass to same pipeline as inline attachments
- [ ] T024 [US3] Add config for attachmentRefs: max size per URL, timeout, max redirects, allowed schemes (default HTTPS)
- [ ] T025 [US3] Add tests in `src/gateway/server-methods/agent.test.ts` or gateway server tests for attachmentRefs: valid HTTPS returns content to agent; invalid scheme or size returns validation error with reason

**Checkpoint**: User Story 3 complete — attachmentRefs supported

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: Optional RPC, observability, and final validation.

- [ ] T026 [P] Optionally implement chat.attachments.get RPC in `src/gateway/server-methods/chat.ts` with params sessionKey, messageId/runId; return list of attachments with content and/or mediaUrl; document in contract if implemented
- [ ] T027 Add logging in `src/gateway/` for attachment validation rejections (type/size) and attachmentRefs fetch failures without including sensitive content (per NFR-003)
- [ ] T028 Run full gateway test suite and quickstart validation: `pnpm test src/gateway` and verify quickstart.md implementation order and key files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 (config/schema). **Blocks all user stories.**
- **Phase 3 (US1)**: Depends on Phase 2. No dependency on US2/US3/US4.
- **Phase 4 (US2)**: Depends on Phase 2. May depend on transcript/reply payload shape from agent (already produced by US1 flow).
- **Phase 5 (US4)**: Depends on Phase 3 and Phase 4 (to verify compat and document contract).
- **Phase 6 (US3)**: Depends on Phase 2 and Phase 3 (reuses same validation and agent delivery format).
- **Phase 7 (Polish)**: Depends on completion of desired user stories.

### User Story Dependencies

- **US1 (P1)**: After Foundational only. MVP.
- **US2 (P1)**: After Foundational; independent of US3.
- **US4 (P1)**: After US1 and US2 (compat + docs).
- **US3 (P2)**: After Foundational and US1 (same pipeline).

### Parallel Opportunities

- T001, T002, T003 can run in parallel (Phase 1).
- T008–T012 (US1) can be partially parallel (different files) after T004–T007.
- T013–T017 (US2): T013 can be [P]; T014–T017 are sequential within US2.
- T017a–T017d (US2 inline relay): T017a first (extract mediaUrl from tool result); T017b (persist); T017c (inject into chat.history); T017d (test).
- T018–T020 (US4): T018 and T019/T020 can be parallel.
- T021–T025 (US3): T021, T022, T024 can be [P]; T023, T025 depend on fetch and schema.

---

## Parallel Example: User Story 1

```bash
# After Phase 2 complete:
# Implement agent wiring and chat.send wiring in parallel (different files):
T008: agent.ts attachment config and unified format
T009: chat.ts chat.send same

# Then wire pipeline and add tests:
T010: agent pipeline consumes unified attachments
T011: server.agent tests
T012: chat.send tests
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Foundational).
3. Complete Phase 3 (US1).
4. **STOP and VALIDATE**: Run `pnpm test src/gateway/chat-attachments src/gateway/server-methods/agent src/gateway/server-methods/chat`; send non-image attachment via RPC and verify agent receives it.
5. Deploy/demo if ready.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. US1 → test independently → MVP (send arbitrary files).
3. US2 → test independently → bidirectional files (receive in history); **T017a–T017d** close the message tool inline relay gap (webchat media in chat.history).
4. US4 → compat + docs → safe adoption.
5. US3 → attachmentRefs → optional large-file path.
6. Polish → optional RPC, logging, full suite.

### Suggested MVP Scope

- **Phase 1 + Phase 2 + Phase 3** (through T012): config, validation, agent + chat.send accepting non-image attachments and delivering to agent in unified format. Independent test: send PDF via RPC, confirm agent receives it and size-limit returns reason.

---

## Notes

- [P] = different files, no dependencies; safe to run in parallel.
- [USn] = task belongs to that user story for traceability.
- Each user story is independently testable per spec.
- Commit after each task or logical group; use `scripts/committer "<msg>" <file...>`.
- Run `pnpm check` and `pnpm test` before pushing when touching logic.
