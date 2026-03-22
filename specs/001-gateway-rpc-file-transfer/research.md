# Research: Gateway RPC Arbitrary File Transfer

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## 1. MIME policy (Telegram-aligned)

**Decision**: Use the OpenClaw Telegram send path and Telegram Bot API as the source of truth for “file types Telegram allows for forwarding.” Do not maintain a separate hardcoded MIME list in the Gateway; instead (a) allow all MIME types by default for inline attachments, and (b) document in the contract that the _recommended_ set for orchestrator→Telegram forwarding is the set supported by Telegram Bot API (e.g. sendDocument accepts multipart uploads for general files; by-URL has narrower guarantees). Optional config allowlist/blocklist can restrict further.

**Rationale**: Spec says “accept any file types that Telegram allows for forwarding”; the orchestrator forwards to Telegram, so the real constraint is what Telegram accepts. Defining the set in documentation (and optionally in config) keeps the Gateway flexible and avoids drift from Telegram API changes.

**Alternatives considered**: (1) Hardcode a MIME list from Telegram docs — rejected because Telegram supports “any” for multipart uploads and the exact set is not strictly enumerated. (2) Allow only image/\* — rejected; spec explicitly expands beyond images.

---

## 2. Large RPC body (streaming / bounded buffer)

**Decision**: Validate attachment size and base64 _before_ fully parsing the rest of the RPC payload where feasible. Use existing `estimateBase64DecodedBytes` (no full decode) for size check; reject over limit with clear error. For attachmentRefs URL fetch, use a bounded buffer or streaming read with a cap (configurable max bytes) so the Gateway never holds an unbounded response in memory.

**Rationale**: NFR-002 requires not loading the full RPC body into memory before validation. Current code already uses `estimateBase64DecodedBytes` in `chat-attachments.ts`; extend that pattern and add a cap on URL-download size for attachmentRefs.

**Alternatives considered**: (1) Full decode then check — rejected (memory spike). (2) Streaming JSON parse — possible future optimization; not required for first version if we reject early on size estimate.

---

## 3. Reply text format (Telegram-compatible)

**Decision**: Ensure assistant message `text` in chat.history (and any RPC response that carries reply text) is in the same format the Telegram send path uses. OpenClaw uses **HTML** for Telegram (`parse_mode: "HTML"`, `renderTelegramHtmlText` in `src/telegram/format.ts`). Document in the contract that the reply text format is HTML (Telegram-compatible) so the orchestrator can forward without reformatting.

**Rationale**: Spec FR-010a and clarifications require reply text compatible with the Telegram channel; the existing Telegram send path already uses HTML; keeping the same format in RPC avoids orchestrator conversion.

**Alternatives considered**: (1) Plain text only — rejected (would require orchestrator to convert to HTML for Telegram). (2) Markdown — rejected; Telegram send path uses HTML, not Markdown.

---

## 4. Message tool inline relay → chat.history media (gap)

**Decision**: When the agent uses `message(send, target=webchat, filePath=...)`, the inline relay path in `message-action-runner.ts` returns a tool result with `mediaUrl` (local path). This payload does **not** currently reach `chat.history.media` because: (a) `enrichAssistantMessagesWithTextAndMedia` only reads media from assistant message **content blocks** (image/file with base64); (b) the message tool result is a separate tool call outcome, not part of assistant content; (c) tool results are stripped from WebSocket events by default (`verbose !== "full"`). The fix: **inject media from message tool inline relay into the reply/chathistory pipeline**. When the run completes and the message tool returned `inlineRelay: true` with `mediaUrl`/`mediaUrls`, the Gateway MUST read those files, convert to base64, and add them to the assistant message `media[]` (or to the broadcast payload) so the orchestrator receives them via `chat.history` or the chat final event.

**Rationale**: Debug trace (2026-03-21) confirmed: "Committed messaging text" logs only text length; no processing of binary file. The inline relay returns mediaUrl but nothing consumes it to produce `chat.history.media`. FR-008 and User Story 2 require "assistant messages in chat history include media with content (base64)" — the message tool is one source of agent-produced files.

**Alternatives considered**: (1) Rely on tool events with verbose=full — rejected; orchestrator often runs in different container and cannot read `/app/workspace` paths. (2) New RPC for tool-result media — adds complexity; inline in chat.history is the spec default. (3) Require orchestrator to poll tool events — not aligned with "deliver files inline in RPC response."
