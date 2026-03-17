# Gateway RPC: Attachments and Media Contract

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

This document describes the Gateway WebSocket RPC contract for file attachments (inbound and outbound). It must be kept in sync with implementation and with docs published for orchestrator/agent clients.

---

## 1. Inbound: Attachments (agent, chat.send)

### 1.1 Format

- **Params**: `attachments` — array of objects.
- **Each item**: `type?` (string), `mimeType?` (string), `fileName?` (string), `content` (string, base64).
- **Backward compatibility**: Existing clients sending only image/\* with same shape continue to work. New: non-image MIME types accepted when allowed by policy.

### 1.2 Limits

- **Per-attachment size**: Configurable; default **100 MB** (decoded bytes). Enforced before agent receives.
- **Aggregate size / max count**: Optional (no default). When configured, enforced and documented in deployment.
- **Validation errors**: Response MUST include reason (e.g. `size_exceeded`, `invalid_base64`, `type_not_allowed`). Machine- and human-readable.

### 1.3 MIME policy

- **Default**: Accept MIME types that Telegram allows for forwarding (see project docs / Telegram Bot API).
- **Config**: Optional `mimeAllowlist` (only these accepted) and `mimeBlocklist` (these rejected). When allowlist is set, only listed types are accepted.

---

## 2. Inbound: Attachment references (attachmentRefs)

### 2.1 Format (optional)

- **Params**: `attachmentRefs` — array of objects: `url` (string, HTTPS), `mimeType?`, `fileName?`.
- **Behavior**: Gateway fetches each URL, enforces size and timeout/redirect limits, and passes content to the agent in the same unified format as inline attachments.

### 2.2 Limits and security

- **Schemes**: Only HTTPS (or configurable allowlist).
- **Size**: Configurable max bytes per URL response; enforced during fetch (bounded buffer).
- **Timeout and redirects**: Configurable; failure returns validation error; no sensitive data in logs.

---

## 3. Agent delivery format

- **Unified shape**: Agent receives attachments (inline or from attachmentRefs) as one format: e.g. `type`, `mimeType`, `fileName`, `data?` (base64) or `path?` (temp file). Image and non-image use the same structure.
- **Usage**: Agent may use non-image as context or pass to tools; behavior is agent-defined.

---

## 4. Outbound: chat.history and assistant messages

### 4.1 Message shape

- **text**: Assistant reply text (string). Format: **Telegram-compatible HTML** so the orchestrator can forward to Telegram without reformatting.
- **media**: Optional array. Each element: `type` (e.g. "text" | "file"), `text?`, `mimeType?`, `fileName?`, `content?` (base64). Optionally `mediaUrl?` for very large or external files.
- **Separation**: Text and binary content do not mix in one field; `text` and `media` are separate.

### 4.2 Inline delivery (default)

- Files produced by the agent are included in the RPC response: Gateway reads local file (or agent output) and sets `media[].content` (base64). No separate GET required.
- **Limits**: Per-attachment size configurable (default **100 MB** via `outgoingPerAttachmentMaxBytes`). Optional aggregate/count when configured.

### 4.3 Optional: mediaUrl and chat.attachments.get

- **mediaUrl**: When present (e.g. large files or external storage), client can download from that URL. If Gateway serves the file, access control and TTL are documented.
- **chat.attachments.get** (optional RPC): Params e.g. sessionKey, messageId/runId. Returns list of attachments with `content` and/or `mediaUrl`. Contract documented if implemented.

---

## 5. Reply text format (Telegram compatibility)

- **Format**: HTML compatible with Telegram `parse_mode: "HTML"` (same as OpenClaw Telegram send path).
- **Rationale**: Orchestrator forwards to Telegram; no conversion needed if response text is already in this format.

---

## 6. Backward compatibility

- Clients that do not send `attachments` or `attachmentRefs` and do not read `media` in messages continue to work unchanged.
- Existing messages without media: chat.history returns same shape as today (text-only or current format).

---

## 7. Config keys (gateway.rpcAttachments)

| Key                             | Type     | Default | Description                                                                      |
| ------------------------------- | -------- | ------- | -------------------------------------------------------------------------------- |
| `perAttachmentMaxBytes`         | number   | 100 MB  | Max decoded bytes per attachment (incoming).                                     |
| `aggregateMaxBytes`             | number   | —       | Optional. Max total decoded bytes per request (incoming).                        |
| `maxCount`                      | number   | —       | Optional. Max number of attachments per request.                                 |
| `mimeAllowlist`                 | string[] | —       | Optional. Only these MIME types accepted (e.g. `["application/pdf","image/*"]`). |
| `mimeBlocklist`                 | string[] | —       | Optional. These MIME types rejected.                                             |
| `outgoingPerAttachmentMaxBytes` | number   | 100 MB  | Max decoded bytes per attachment for outgoing media in chat.history.             |

Config path: `gateway.rpcAttachments` in OpenClaw config.

## 8. Deployment note (proxy / WebSocket message size)

- Default per-attachment limit is **100 MB**. If the Gateway sits behind a reverse proxy or uses a WebSocket frame/message size limit, ensure the proxy and WebSocket server allow message bodies of at least 100 MB (or the configured limit) so that large attachments are not rejected at the infrastructure layer.
