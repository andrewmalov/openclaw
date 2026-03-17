---
summary: "How to use Gateway WebSocket RPC for agent and chat with file attachments"
read_when:
  - Building an orchestrator or bot that talks to OpenClaw Gateway over WebSocket
  - Sending files (images, PDFs, etc.) to the agent or receiving files in chat history
title: "Orchestrator RPC Guide"
---

# Orchestrator RPC Guide

This page describes how to use the Gateway WebSocket RPC to send and receive messages **with file attachments** when building an orchestrator (e.g. a Telegram bot or API layer that forwards user messages to the Gateway).

For handshake, framing, and auth, see [Gateway protocol](/gateway/protocol).

---

## Sending messages with attachments

### Methods: `agent` and `chat.send`

Both methods accept an optional **`attachments`** array. Each item is a single file (inline base64).

**Request params (common shape):**

| Field            | Type   | Required | Description                                          |
| ---------------- | ------ | -------- | ---------------------------------------------------- |
| `sessionKey`     | string | yes      | Session key (e.g. `main`, `telegram:123:456`).       |
| `message`        | string | yes      | User message text.                                   |
| `attachments`    | array  | no       | Inline file attachments (see below).                 |
| `idempotencyKey` | string | no       | Recommended for `chat.send` to avoid duplicate runs. |

**Attachment item shape:**

| Field      | Type   | Required | Description                                     |
| ---------- | ------ | -------- | ----------------------------------------------- |
| `content`  | string | yes      | File content as **base64**.                     |
| `type`     | string | no       | e.g. `"image"` or `"file"`. Omitted for images. |
| `mimeType` | string | no       | e.g. `image/png`, `application/pdf`.            |
| `fileName` | string | no       | Original filename for display.                  |

**Example: send a message with an image and a PDF**

```json
{
  "type": "req",
  "id": "req-1",
  "method": "agent",
  "params": {
    "sessionKey": "main",
    "message": "Summarize the document and describe the chart.",
    "attachments": [
      {
        "mimeType": "image/png",
        "fileName": "chart.png",
        "content": "<base64-encoded-image>"
      },
      {
        "type": "file",
        "mimeType": "application/pdf",
        "fileName": "report.pdf",
        "content": "<base64-encoded-pdf>"
      }
    ]
  }
}
```

**Example: `chat.send` (same `attachments` shape)**

```json
{
  "type": "req",
  "id": "req-2",
  "method": "chat.send",
  "params": {
    "sessionKey": "main",
    "message": "What's in this file?",
    "attachments": [
      {
        "type": "file",
        "mimeType": "application/pdf",
        "fileName": "doc.pdf",
        "content": "<base64>"
      }
    ],
    "idempotencyKey": "chat-abc-123"
  }
}
```

### Limits and validation errors

- **Per-attachment size**: Default **100 MB** (decoded bytes). Configurable by the Gateway (`gateway.rpcAttachments.perAttachmentMaxBytes`).
- **MIME policy**: By default, MIME types allowed for Telegram forwarding are accepted. The Gateway can restrict or extend via `mimeAllowlist` / `mimeBlocklist`.

When validation fails, the response has `ok: false` and an **`error`** object. Use **`error.details.reason`** for machine-readable handling:

| `error.details.reason` | Meaning                                               |
| ---------------------- | ----------------------------------------------------- |
| `size_exceeded`        | Attachment decoded size exceeds the configured limit. |
| `invalid_base64`       | `content` is not valid base64.                        |
| `type_not_allowed`     | MIME type not allowed by policy.                      |

**Example error response**

```json
{
  "type": "res",
  "id": "req-1",
  "ok": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Attachment validation failed: size limit exceeded",
    "details": {
      "reason": "size_exceeded"
    }
  }
}
```

Handle these in the orchestrator (e.g. show a user-friendly message or retry with a smaller file).

---

## Receiving replies: `chat.history`

After the agent replies, call **`chat.history`** to get the conversation. Assistant messages now include **`text`** (reply body) and optional **`media`** (files produced by the agent).

### Request

```json
{
  "type": "req",
  "id": "req-3",
  "method": "chat.history",
  "params": {
    "sessionKey": "main",
    "limit": 50
  }
}
```

### Response: message shape

**`payload.messages`** is an array of messages. Each **assistant** message has:

| Field     | Type   | Description                                                                                                        |
| --------- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| `role`    | string | `"assistant"`                                                                                                      |
| `text`    | string | Reply text in **Telegram-compatible HTML**. Safe to send to Telegram with `parse_mode: "HTML"` without conversion. |
| `media`   | array  | Optional. Files/images produced by the agent (e.g. generated charts, exported files).                              |
| `content` | array  | Legacy content blocks; still present. Prefer `text` + `media` for new code.                                        |

**`media[]` item shape:**

| Field      | Type   | Description                                                              |
| ---------- | ------ | ------------------------------------------------------------------------ |
| `type`     | string | `"image"` or `"file"`.                                                   |
| `mimeType` | string | Optional. e.g. `image/png`, `application/pdf`.                           |
| `fileName` | string | Optional. Suggested filename.                                            |
| `content`  | string | Optional. Inline base64 when the file is within the outgoing size limit. |
| `mediaUrl` | string | Optional. Reserved for future use (large or external files).             |

If the Gateway omits **`content`** for an item (e.g. file over the outgoing limit), the item still has `type`, `mimeType`, `fileName`; the client can show a placeholder or use a future `mediaUrl` if present.

**Example: assistant message with text and one image**

```json
{
  "role": "assistant",
  "timestamp": 1737123456789,
  "text": "Here is the chart you asked for:",
  "media": [
    {
      "type": "image",
      "mimeType": "image/png",
      "fileName": "chart.png",
      "content": "<base64-encoded-png>"
    }
  ],
  "content": [...]
}
```

**Example: text-only message (no files)**

```json
{
  "role": "assistant",
  "timestamp": 1737123456790,
  "text": "I don't have a file to attach for this one.",
  "content": [...]
}
```

(`media` may be absent or an empty array.)

### Using reply text with Telegram

- **`message.text`** is already HTML compatible with Telegram’s `parse_mode: "HTML"`.
- Send it to Telegram as-is (e.g. in `sendMessage(..., { parse_mode: "HTML" })`). No markdown or HTML conversion needed on the orchestrator side.

### Using `media` in the orchestrator

1. Iterate `message.media` (if present).
2. For each item with **`content`**: decode base64 and send as photo/document/audio etc. to your channel (e.g. Telegram `sendPhoto` / `sendDocument`).
3. Use **`mimeType`** and **`fileName`** for type and filename when uploading or saving.
4. If **`content`** is missing, the file was over the Gateway’s outgoing limit; you can show a placeholder or wait for a future `mediaUrl` if the Gateway adds it.

---

## Backward compatibility

- **Not sending attachments**: Omit `attachments` or send `[]`. Behavior is unchanged.
- **Not reading media**: Ignore `message.media` and use `message.text` or existing `content`. Existing clients keep working.
- **Existing message shape**: Messages still have `role`, `content`, and other existing fields; `text` and `media` are additive.

---

## Contract and config

- **Full contract** (limits, MIME policy, config keys, deployment note for proxy/WebSocket message size): [Gateway RPC attachments contract](https://github.com/openclaw/openclaw/blob/main/specs/001-gateway-rpc-file-transfer/contracts/gateway-rpc-attachments.md).
- **Config keys** for attachment limits and MIME policy: [Configuration Reference — RPC attachments](/gateway/configuration-reference#rpc-attachments-gatewayrpcattachments).
