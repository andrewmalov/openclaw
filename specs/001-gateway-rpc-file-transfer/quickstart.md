# Quickstart: Implementing Gateway RPC File Transfer

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Implementation order

1. **Inbound validation and MIME/size (agent + chat.send)**
   - In `src/gateway/chat-attachments.ts`: stop dropping non-image attachments; accept MIME types per Telegram-aligned policy; make maxBytes configurable (default 100 MB).
   - In `src/gateway/server-methods/agent.ts` and `chat.ts`: pass configurable maxBytes into parseMessageWithAttachments (or new validator); return validation errors with reason (size, invalid base64, type not allowed).
   - Extend agent pipeline so non-image attachments are delivered to the agent in the same structural format as images (e.g. extend `ParsedMessageWithImages` to a generic “attachments” list with type, mimeType, fileName, data/path).
   - Add config keys for per-attachment limit and optional MIME allowlist/blocklist.
   - **Tests**: Extend `chat-attachments.test.ts`, `server.agent.gateway-server-agent-a.test.ts`, and chat.send tests for non-image, size limit, and error reason.

2. **Outbound: chat.history with media**
   - Define response shape: each assistant message has `text` and optional `media[]` with `type`, `mimeType`, `fileName`, `content` (base64).
   - When building chat.history response, enrich messages from transcript and/or completion payload: if agent produced files, read local files (or use stored refs) and fill `media[].content`.
   - **Message tool inline relay gap**: When the message tool returns `inlineRelay: true` with `mediaUrl`/`mediaUrls`, the Gateway MUST consume those paths, read files, base64-encode, and inject into assistant message `media[]`. Implementation touch points: `src/infra/outbound/message-action-runner.ts` (already produces mediaUrl), `src/gateway/server-methods/chat.ts` (`enrichAssistantMessagesWithTextAndMedia`), and Pi run completion / tool-result handlers (to capture inline relay media and pass to chat history builder).
   - Ensure reply `text` is Telegram-HTML compatible (use or align with `src/telegram/format.ts` when building text for response).
   - **Tests**: chat.history returns messages with media when agent produced files; existing clients without media unchanged; message tool with target=webchat + filePath produces media in chat.history.

3. **Optional: attachmentRefs**
   - Add params validation for `attachmentRefs` in agent (and chat.send if applicable).
   - In Gateway: for each ref, fetch URL (HTTPS only or allowlist), enforce size and timeout/redirect limits with bounded buffer, then pass content to same pipeline as inline attachments.
   - **Tests**: attachmentRefs resolve to agent; invalid URL/size/timeout return clear error.

4. **Optional: chat.attachments.get**
   - New RPC handler; params sessionKey, messageId/runId; return list of attachments with content and/or mediaUrl.
   - **Tests**: basic success and not-found.

5. **Docs and contract**
   - Publish contract (this directory + deployment docs): limits, MIME policy, attachmentRefs, chat.history media shape, reply text format.
   - Document config keys and infrastructure notes (proxy/WebSocket message size for 100 MB).

## Key files to touch

| Area                     | Files                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| Validation / MIME / size | `src/gateway/chat-attachments.ts`, `src/gateway/server-methods/attachment-normalize.ts`            |
| Agent RPC                | `src/gateway/server-methods/agent.ts`, protocol schema for agent                                   |
| Chat RPC                 | `src/gateway/server-methods/chat.ts` (chat.send, chat.history)                                     |
| Config                   | Gateway/config schema for attachment limits and MIME policy                                        |
| attachmentRefs fetch     | New helper (e.g. in gateway or using `src/web/media`) with size/timeout/redirect limits            |
| Reply text format        | Ensure chat.history (and any reply builder) uses Telegram-HTML; reference `src/telegram/format.ts` |

## Running tests

- Unit: `pnpm test src/gateway/chat-attachments src/gateway/server-methods/chat src/gateway/server-methods/agent`
- Broader gateway: `pnpm test src/gateway`
- E2E if added: follow repo e2e patterns for Gateway RPC.

## Config (to add)

- Per-attachment size limit (incoming): default 100_000_000 (100 MB).
- Per-attachment size limit (outgoing inline): default 100_000_000.
- Optional: aggregate size per request; max attachments per request.
- Optional: MIME allowlist or blocklist.
- attachmentRefs: max size per URL, timeout, max redirects; allowed schemes (default HTTPS only).
