# Implementation Plan: Gateway RPC Arbitrary File Transfer

**Branch**: `001-gateway-rpc-file-transfer` | **Date**: 2025-03-17 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/001-gateway-rpc-file-transfer/spec.md`

## Summary

Enable bidirectional transfer of arbitrary files (not only images) over the Gateway WebSocket RPC: orchestrator → agent and agent → orchestrator. Flow: (Telegram bot) ↔ API ↔ (orchestrator) ↔ RPC ↔ (gateway) ↔ (agent). Incoming: accept attachments with MIME types allowed by Telegram for forwarding; configurable per-attachment limit (default 100 MB); optional attachmentRefs (Gateway fetches HTTPS URLs). Outgoing: deliver files inline in RPC response (content base64 in message media array), same model as Telegram; reply text format compatible with Telegram (HTML). **Gap addressed**: The message tool inline relay path (agent calls `message(send, target=webchat, filePath=...)`) produces `mediaUrl` in the tool result but it does not reach `chat.history.media`; the plan closes this loop by injecting inline relay media into the assistant message media pipeline. Implementation lives in Gateway (`src/gateway`) and infra (`message-action-runner`, run completion handlers): validation, attachment normalization, chat-attachments pipeline, chat.history response shape, message-tool media injection, and optional attachmentRefs fetch.

## Technical Context

**Language/Version**: TypeScript (ESM), Node 22+  
**Primary Dependencies**: Existing Gateway stack (WebSocket, Pi session transcripts, config), `src/media` (base64, MIME), `src/web/media` (loadWebMedia for URL fetch if attachmentRefs), `src/telegram/format` (HTML for reply text), `src/infra/outbound/message-action-runner` (message tool inline relay with mediaUrl)  
**Storage**: Session transcripts (JSONL) under configured store path; no new DB. Outgoing inline files are read from agent output paths or existing reply payload and embedded in RPC response.  
**Testing**: Vitest; colocated `*.test.ts` in `src/gateway` (e.g. `chat-attachments.test.ts`, `server-methods/chat.test.ts`, `server-methods/agent.ts` + send tests). E2E where needed for agent↔gateway flow.  
**Target Platform**: Gateway server (Node); orchestrator and agent are clients.  
**Project Type**: WebSocket RPC service (Gateway); contract and implementation in `src/gateway`.  
**Performance Goals**: Per-attachment 100 MB default; no full-body load before validation (streaming/bounded buffer per NFR-002).  
**Constraints**: Infrastructure (proxy, WebSocket server) may need config for large messages; document. Reply text in chat.history must be Telegram-HTML compatible.  
**Scale/Scope**: Single Gateway instance; configurable limits; optional aggregate/count limits.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Module and Structure**: Feature code under `src/gateway` (server-methods, chat-attachments, protocol/schema). No new root-level deps; no new channel/extension (orchestrator is external). No labeler change unless we add a new top-level area.
- **II. CLI and Interface**: No new CLI surface; RPC contract only. Status/table/palette unchanged.
- **III. Test and Evidence**: Colocated tests in `src/gateway`; regression tests for existing agent/chat.send behavior; new tests for non-image attachments, limits, attachmentRefs, chat.history media.
- **IV. Code Quality and Typing**: TypeScript strict; no prototype mutation; keep files under ~700 LOC; add comments for non-obvious logic.
- **V. PR Truthfulness and Triage**: Scope from spec; no speculative bug-fix claims without evidence.

No exceptions required.

## Project Structure

### Documentation (this feature)

```text
specs/001-gateway-rpc-file-transfer/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1 (RPC attachment + history media)
│   └── gateway-rpc-attachments.md
└── tasks.md             # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── gateway/
│   ├── server-methods/
│   │   ├── agent.ts           # agent RPC: attachments + optional attachmentRefs
│   │   ├── chat.ts             # chat.send, chat.history (media in response)
│   │   ├── send.ts             # send RPC if it accepts attachments
│   │   ├── attachment-normalize.ts  # RPC → ChatAttachment (existing)
│   │   └── ...                 # existing handlers
│   ├── chat-attachments.ts     # MIME policy (Telegram-allowed), size limits, parseMessageWithAttachments extended for non-image
│   ├── protocol/
│   │   └── schema/            # agent, chat params (attachments, attachmentRefs)
│   ├── session-utils*.ts       # read messages (unchanged or extend for media in response only)
│   └── ...
├── media/                      # base64 size estimate, MIME sniff (existing)
├── web/media.ts                # loadWebMedia for attachmentRefs fetch (Gateway)
└── telegram/format.ts          # renderTelegramHtmlText for reply text format (reference)
```

**Structure Decision**: All implementation in existing `src/gateway` and `src/media`; no new top-level packages. Contract documentation in `specs/001-gateway-rpc-file-transfer/contracts/`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| (none)    | —          | —                                    |
