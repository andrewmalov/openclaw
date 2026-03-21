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

## Required scopes at connect

The Gateway checks **scopes** on every request. If your client does not declare the right scopes in the **`connect`** handshake, you get errors like `missing scope: operator.write`.

When opening the WebSocket connection, send a `connect` request with **`params.scopes`** including at least:

| Scope            | Needed for                                       |
| ---------------- | ------------------------------------------------ |
| `operator.write` | `agent`, `chat.send`, `chat.abort`, `agent.wait` |
| `operator.read`  | `chat.history`, `sessions.list`, `status`, etc.  |

**Example:** minimal scopes for an orchestrator that sends messages and reads history:

```json
{
  "type": "req",
  "id": "connect-1",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "role": "operator",
    "scopes": ["operator.read", "operator.write"],
    "client": { "id": "orchestrator", "version": "1.0.0", "platform": "linux", "mode": "operator" },
    "auth": { "token": "<your-gateway-token>" },
    "device": {
      "id": "<device-id>",
      "publicKey": "<...>",
      "signature": "<...>",
      "signedAt": 1234567890,
      "nonce": "<challenge-nonce>"
    }
  }
}
```

If you only send `operator.read`, calls to `agent` or `chat.send` will fail with `missing scope: operator.write`. Add `operator.write` to `scopes` and reconnect.

### Connecting without device identity

If your orchestrator connects **without** sending `params.device` (token-only auth), the Gateway normally **clears** requested scopes for non–Control UI clients. You will see `missing scope: operator.write` on `agent` even though you sent `operator.write` in `connect.params.scopes`.

The deployment must explicitly allow your client ID. In the **agent’s** config (e.g. `~/.openclaw/openclaw.json` or the pod’s config), set:

```json
{
  "gateway": {
    "backendOperatorScopeClientIds": ["gateway-client"]
  }
}
```

Use the same string as your `params.client.id` (e.g. `"gateway-client"`). Only client IDs in this list are allowed to keep requested scopes when connecting without device. See [Configuration Reference — Backend operator scopes](/gateway/configuration-reference#backend-operator-scopes-without-device).

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

## Troubleshooting: files not reaching the assistant

If the orchestrator sends `params.attachments` (and optionally `params.message`) but the agent does not see the files:

1. **Path**: Gateway passes `params.attachments` through validation (size, base64, MIME) and forwards them to the agent runtime. The agent receives them as unified attachments (images + non-image files). Non-image files are materialized into the run workspace for tools (e.g. `read_file`).

2. **MIME policy**: By default there is **no** allowlist or blocklist, so types such as `application/pdf`, `audio/ogg`, `image/*` are accepted. If the deployment sets **`gateway.rpcAttachments.mimeAllowlist`**, only those MIME types are allowed; if **`mimeBlocklist`** is set, those types are rejected. Check the agent’s config (e.g. `~/.openclaw/openclaw.json` or pod config) and the [config reference](/gateway/configuration-reference#rpc-attachments-gatewayrpcattachments).

3. **Timeout**: If you only see a timeout (e.g. from `agent.wait`), the run may be slow or stuck. The default wait timeout is **120 s**. Use **`agent.wait`** with **`params.timeoutMs`** (e.g. `120000` or higher) to wait longer. On timeout, the response has `status: "timeout"` and an `error` message; you can show that to users or retry with a larger timeout.

---

## Troubleshooting: assistant cannot send file to the user (orchestrator)

If the assistant generates an image or file but the user never receives it (e.g. they see an apology like “ошибка доступа к Telegram-боту” or only text):

1. **Get media from chat.history**: The assistant’s reply (text + images/files) is returned in **`chat.history`** in the last assistant message: **`message.text`** and **`message.media`**. Call **`chat.history`** after **`agent.wait`** completes so the run’s final reply is in the transcript. Use the **last** assistant message in the slice; its **`media`** array holds the files.

2. **Check `media[].content`**: Each media item has **`type`**, **`mimeType`**, **`fileName`**, and optionally **`content`** (base64). If **`content`** is missing, the file exceeded the Gateway’s **outgoing** size limit (**`gateway.rpcAttachments.outgoingPerAttachmentMaxBytes`**, default 100 MB). Increase that in the agent’s config if you need larger inline files, or handle “no content” in the orchestrator (e.g. show “file too large” or skip).

3. **Orchestrator must send to the channel**: The Gateway does not send to Telegram. The **orchestrator** must take **`message.media`**, decode each item’s **`content`** (base64), and send it to the user (e.g. **Telegram**: `sendPhoto` for `image/*`, `sendDocument` for others). If the user sees “ошибка доступа к Telegram-боту” or similar, the failure is usually on the **orchestrator/Telegram** side (token, permissions, Telegram file/size limits, or network). The Gateway has already returned the media in **chat.history**; ensure the orchestrator (a) reads **message.media**, (b) decodes **content**, and (c) calls the correct Telegram API with the buffer. Log orchestrator send errors to see the real Telegram API error.

4. **Message tool with target webchat (file relay)**: If the assistant uses the **message** tool with **target: "webchat"** to send a file (e.g. generated report/avatar), Gateway treats this as a **webchat inline relay** instead of routing to Telegram. The tool returns payload with `mediaUrl`/`mediaUrls`, and the orchestrator receives it through normal reply/media flow. This avoids the old failure where `webchat` was resolved as a Telegram recipient (`getChat`) and failed with 401.

5. **Text-only message tool sends to webchat are still blocked**: For webchat sessions, use normal assistant text replies for text-only output. `message(action="send", target="webchat")` is intended for media/file relay.

---

## Example agent configuration for webchat and file transfer

Use this config (or merge into your existing `~/.openclaw/openclaw.json` or pod config) when the agent runs in webchat/orchestrator sessions and needs to send or receive files.

```json
{
  "gateway": {
    "backendOperatorScopeClientIds": ["orchestrator", "gateway-client"],
    "rpcAttachments": {
      "perAttachmentMaxBytes": 104857600,
      "outgoingPerAttachmentMaxBytes": 104857600
    }
  },
  "agents": {
    "defaults": {
      "extraSystemPrompt": "When in webchat/orchestrator sessions, use message tool with target=\"webchat\" (not \"current\") for file/media sends. Text-only replies go as normal assistant messages."
    }
  },
  "tools": {
    "sessions_spawn": {
      "attachments": {
        "enabled": true
      }
    }
  },
  "channels": {
    "telegram": {
      "botToken": "<your-telegram-bot-token>"
    }
  }
}
```

### Key sections

| Section                                    | Purpose                                                                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `gateway.backendOperatorScopeClientIds`    | Allow orchestrator to connect without device identity. Use the same strings as `params.client.id` in your `connect` request.     |
| `gateway.rpcAttachments`                   | Incoming/outgoing file size limits (bytes). Default 100 MB each. Adjust if you need larger files.                                |
| `agents.defaults.extraSystemPrompt`        | Instructs the model to use `target="webchat"` for file sends in webchat sessions, avoiding 401 when only Telegram is configured. |
| `tools.sessions_spawn.attachments.enabled` | Lets subagents receive file attachments. Optional; only needed if you spawn subagents with files.                                |
| `channels.telegram`                        | Required if the orchestrator forwards replies to Telegram. Omit if you only use webchat.                                         |

### Minimal config (webchat-only, no Telegram)

If the agent talks only via webchat and the orchestrator does not send to Telegram:

```json
{
  "gateway": {
    "backendOperatorScopeClientIds": ["orchestrator"],
    "rpcAttachments": {
      "perAttachmentMaxBytes": 52428800,
      "outgoingPerAttachmentMaxBytes": 52428800
    }
  },
  "agents": {
    "defaults": {
      "extraSystemPrompt": "In webchat sessions, use message tool target=\"webchat\" for file/media sends."
    }
  }
}
```

(50 MB limits; no Telegram channel.)

---

## Backward compatibility

- **Not sending attachments**: Omit `attachments` or send `[]`. Behavior is unchanged.
- **Not reading media**: Ignore `message.media` and use `message.text` or existing `content`. Existing clients keep working.
- **Existing message shape**: Messages still have `role`, `content`, and other existing fields; `text` and `media` are additive.

---

## Contract and config

- **Full contract** (limits, MIME policy, config keys, deployment note for proxy/WebSocket message size): [Gateway RPC attachments contract](https://github.com/openclaw/openclaw/blob/main/specs/001-gateway-rpc-file-transfer/contracts/gateway-rpc-attachments.md).
- **Config keys** for attachment limits and MIME policy: [Configuration Reference — RPC attachments](/gateway/configuration-reference#rpc-attachments-gatewayrpcattachments).
