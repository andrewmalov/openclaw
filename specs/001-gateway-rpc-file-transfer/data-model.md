# Data Model: Gateway RPC Arbitrary File Transfer

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Entities

### Attachment (inbound)

- **Purpose**: File sent by the client (orchestrator) to the agent via RPC.
- **Fields**: `type?`, `mimeType?`, `fileName?`, `content` (base64 string) or reference via attachmentRefs.
- **Validation**: Per-attachment size limit (default 100 MB decoded); optional aggregate size and max count when configured. MIME: default policy aligned with Telegram-forwarding (see research); optional allowlist/blocklist in config. Base64 must be valid; invalid or over-size returns validation error with reason.
- **Lifecycle**: Received in `agent` or `chat.send` params → normalized to `ChatAttachment` → validated (size, MIME) → passed to parseMessageWithAttachments (or extended pipeline) for agent consumption. No persistent storage of raw attachment in Gateway beyond passing to agent.

### AttachmentRef (inbound)

- **Purpose**: Reference to a file by URL; Gateway fetches and turns it into the same shape as inline attachments.
- **Fields**: `url`, `mimeType?`, `fileName?`.
- **Validation**: Only HTTPS (or configurable scheme allowlist); configurable max size and max count; timeout and redirect limits. Fetch performed by Gateway; size checked during download (bounded buffer).
- **Lifecycle**: Client sends in params.attachmentRefs → Gateway fetches URL → content (or temp file path) merged into unified attachment format for agent. Failed fetch returns validation error; no sensitive data in logs.

### Message (assistant) in RPC response

- **Purpose**: One assistant message in chat.history or similar response.
- **Fields**: `text` (reply text, Telegram-HTML compatible), `media?` (array of outbound media items). Each media item: `type` (e.g. "text" | "file"), `text?`, `mimeType?`, `fileName?`, `content?` (base64), `mediaUrl?` (optional for large/external files).
- **Validation**: text and media are separate (no mixing). Optional per-attachment and aggregate size limits for inline content when configured.
- **Lifecycle**: Built from session transcript and/or agent reply payload; when agent produced files, Gateway reads local files (or uses agent-provided URLs) and embeds content in media[].content; response returned to client.

### Message tool inline relay result (agent → chat.history)

- **Purpose**: When the agent calls `message(send, target=webchat, filePath=...)`, the message-action-runner returns a tool result with `inlineRelay: true` and `mediaUrl` (or `mediaUrls`). This is a **source of agent-produced files** that must reach `chat.history.media`.
- **Fields**: Tool result includes `mediaUrl` (string, local path) or `mediaUrls` (array). Gateway must read file(s), convert to base64, and inject into assistant message `media[]`.
- **Lifecycle**: Run completes → Gateway detects message tool inline relay result → reads local files at mediaUrl(s) → converts to base64 → adds to assistant message media (or chat final broadcast) → orchestrator receives via chat.history or WebSocket event.
- **Validation**: Same per-attachment size limits as outbound media; invalid paths or read failures logged; no sensitive data in logs.

### Attachments list (outbound, optional RPC)

- **Purpose**: Result of optional `chat.attachments.get` RPC.
- **Fields**: List of items with identifiers and either `content` (base64) or `mediaUrl` per attachment.
- **Lifecycle**: Query by sessionKey and messageId/runId; return list; no new entity storage, derived from session/run state.

## State / storage

- **Session transcript**: Existing Pi JSONL; assistant messages have `content: [{ type: "text", text: "..." }]`. Media in RPC response can be derived from: (a) transcript if we extend stored content to include file refs, (b) agent reply payload at completion time, or **(c) message tool inline relay result** (mediaUrl/mediaUrls from tool result). Decision: Gateway adds media to the response when building chat.history; for the message-tool path, Gateway MUST consume inline relay mediaUrl(s) and inject into assistant message media.
- **No new tables or stores**: Temporary files for attachmentRefs fetch can live in existing temp dir with cleanup; no dedicated Gateway blob store for outgoing files when using inline content.

## Validation rules (summary)

| Entity / flow          | Rule                                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Inbound attachment     | Per-attachment size ≤ configured (default 100 MB); valid base64; MIME allowed by policy (Telegram-aligned or allowlist/blocklist). |
| Inbound attachmentRefs | HTTPS (or allowlist); fetch size ≤ configured; timeout and redirect limits.                                                        |
| Outbound media         | Per-attachment size ≤ configured when set; optional aggregate/count.                                                               |
| Reply text             | Format is Telegram-HTML compatible (documented in contract).                                                                       |
