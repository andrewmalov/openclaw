# Feature Specification: Gateway RPC Arbitrary File Transfer

**Feature Branch**: `001-gateway-rpc-file-transfer`  
**Created**: 2025-03-17  
**Status**: Draft  
**Input**: User description: "Требования: передача произвольных файлов через Gateway RPC" (and detailed requirements below).

## Summary

Enable transfer of arbitrary files (not only images) in both directions over the Gateway RPC: from orchestrator to agent and from agent to orchestrator. The orchestrator is implemented in a separate project and forwards messages to Telegram. End-to-end flow: **(Telegram bot) ↔ API ↔ (orchestrator) ↔ RPC ↔ (gateway) ↔ (agent)**. Scope covers the Gateway contract and implementation (WebSocket RPC); orchestrator and agent act as clients of this contract. Reply text in RPC responses must be formatted for compatibility with the Telegram channel so the orchestrator can forward messages without reformatting. Out of scope: Telegram bot/API implementation, HTTP OpenResponses, and delivery to external channels (unchanged).

## Clarifications

### Session 2025-03-17

- Q: When a client sends attachmentRefs with HTTPS URLs, which component should perform the download and make the content available to the agent? → A: Gateway resolves URLs: Gateway downloads the file, applies security/size limits, and passes content to the agent in the same format as inline attachments.
- Q: How should outgoing files (agent → orchestrator) be delivered—via a download URL or inline in the RPC response? → A: Analogous to Telegram: the Gateway takes the local file (or agent output) and delivers it as an attachment in the RPC response. The orchestrator receives the file inline (e.g. base64 content in the message/media payload); no separate GET to a mediaUrl is required for the default path. mediaUrl remains optional for very large files or when the agent provides an external storage URL.
- Q: When no MIME allowlist/blocklist is configured, which incoming attachment types should be accepted? → A: Accept any file types that Telegram allows for forwarding. The default MIME policy is aligned with Telegram’s accepted types for file transfer; optional allowlist/blocklist can further restrict or extend.
- Q: What is the end-to-end flow and how should reply text be formatted? → A: Flow is (Telegram bot) ↔ API ↔ (orchestrator) ↔ RPC ↔ (gateway) ↔ (agent). The orchestrator forwards messages from the gateway to Telegram; therefore the text format in RPC responses (e.g. chat.history) MUST be compatible with the Telegram channel (same or directly convertible format) so the orchestrator can forward without reformatting.
- Q: How should aggregate size and max attachment count per request be limited by default? → A: Only the per-attachment limit (100 MB) applies by default. No default aggregate size or max count; deployers may configure aggregate size and/or max attachment count per request if needed. Document this in the contract.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Send Arbitrary Files from Client to Agent (Priority: P1)

A client (orchestrator) sends a request to the agent via RPC with one or more file attachments—documents, PDFs, audio, or video—within configured size limits. The Gateway accepts them, validates type and size, and forwards them to the agent in a unified format. The agent can use them as context or pass them to tools.

**Why this priority**: Core value; without it, only images can be sent and the feature goal is not met.

**Independent Test**: Send a non-image attachment (e.g. PDF) via the RPC; verify it is not dropped and is delivered to the agent in the agreed format. Repeat with different MIME types within limits.

**Acceptance Scenarios**:

1. **Given** a valid RPC request with `attachments` containing a PDF (base64), **When** the request is submitted, **Then** the Gateway accepts it and the agent receives the attachment with correct MIME and metadata.
2. **Given** a request with an attachment exceeding the per-attachment size limit, **When** the request is submitted, **Then** the Gateway returns a validation error that states the reason (e.g. size exceeded).
3. **Given** a request with an attachment of a supported non-image MIME type, **When** the request is processed, **Then** the attachment is not discarded and is available to the agent in the same structural format as images (e.g. type, mimeType, fileName, data or path).

---

### User Story 2 - Receive Files from Agent in History (Priority: P1)

A client (orchestrator) reads assistant messages and needs to obtain files produced by the agent. Delivery is analogous to Telegram: the Gateway takes the local file produced by the agent and includes it as an attachment in the RPC response. Assistant messages in chat history include media: a list of attachments with type, optional text, mimeType, fileName, and **content** (e.g. base64) so the client receives the file inline with the message. Optionally, mediaUrl may be present for very large files or external storage; the client may then download via that URL or via a dedicated RPC (e.g. chat.attachments.get) if offered.

**Why this priority**: Completes the bidirectional file transfer; otherwise the client cannot retrieve agent-generated files.

**Independent Test**: Have the agent produce a file (e.g. generated document); request chat history; verify the client receives media entries with content (base64) and can use the file without a separate download step. If mediaUrl or chat.attachments.get is used, verify that path also works.

**Acceptance Scenarios**:

1. **Given** an assistant message that includes one or more file attachments, **When** the client requests chat history, **Then** the message includes a media list with content (e.g. base64) and metadata (mimeType, fileName) so the client has the file inline; no separate download required for the default path.
2. **Given** a session and a message/run identifier, **When** the client calls the attachments RPC (if provided), **Then** it receives a list of attachments with content and/or mediaUrl as per contract.
3. **Given** existing messages that have no media, **When** the client reads history, **Then** behavior remains unchanged (text-only or current format); no breaking change for existing clients.

---

### User Story 3 - Optional: Send Files by Reference (URL) (Priority: P2)

A client sends file references instead of inline base64: e.g. `attachmentRefs: [{ url, mimeType?, fileName? }]` for files available over HTTP/HTTPS. The Gateway fetches the URL subject to configured limits (size, count, scheme) and passes the content to the agent in the same unified format as inline attachments.

**Why this priority**: Reduces payload size and avoids WebSocket frame limits for large files; optional (Should).

**Independent Test**: Send a request with `attachmentRefs` pointing to an HTTPS URL; verify the agent receives the file content (or a local path) and that invalid URLs or size excess produce a clear error.

**Acceptance Scenarios**:

1. **Given** a valid HTTPS URL and configured limits, **When** the client sends attachmentRefs, **Then** the Gateway resolves the URL and the agent receives the file in the unified attachment format.
2. **Given** an HTTP (non-HTTPS) URL when only HTTPS is allowed, **When** the client sends attachmentRefs, **Then** the Gateway rejects or ignores it with a clear validation error.
3. **Given** a URL that returns a response exceeding the configured size, **When** the download is attempted, **Then** the transfer is aborted and an error is returned without exposing sensitive data in logs.

---

### User Story 4 - Backward Compatibility and Contract Documentation (Priority: P1)

Existing clients that do not send new fields and do not expect media in responses continue to work. The contract is documented: attachment and attachmentRef formats, size/count limits, format of messages with media in history, and any new RPC such as chat.attachments.get.

**Why this priority**: Prevents regressions and enables safe adoption.

**Independent Test**: Run existing client flows without sending attachments or reading media; verify behavior is unchanged. Verify documentation exists for all new/updated contract elements.

**Acceptance Scenarios**:

1. **Given** a client that sends no attachments and does not read media from messages, **When** it uses the same RPCs as before, **Then** behavior is unchanged.
2. **Given** a stakeholder or developer, **When** they consult the contract documentation, **Then** they find descriptions of attachments, attachmentRefs, limits, and history/attachments response format.

---

### Edge Cases

- What happens when the same request contains both inline attachments and attachmentRefs? Both are supported; each is validated against its limits.
- What happens when a client sends an attachment with invalid base64? The Gateway returns a validation error that includes the reason (e.g. invalid base64).
- What happens when the total size of all attachments in one request exceeds a configured aggregate limit (if set)? The Gateway rejects the request with a clear validation error. If no aggregate limit is configured, only per-attachment size applies.
- What happens when mediaUrl is used and points to a file that has expired (TTL)? The client receives the URL as per contract; download may fail; TTL is configured and documented. When content is inline, no TTL applies to the response itself.
- What happens when redirects or timeouts occur while the Gateway fetches attachmentRefs? Limits on redirects and a timeout are enforced; failure produces a safe error and is logged without sensitive data.
- What happens when the total size of outgoing inline media exceeds a configured limit (if set)? The Gateway applies the documented policy (e.g. reject, or use mediaUrl for excess/large items). If no aggregate limit is configured, only per-attachment size applies.
- What if a proxy or WebSocket server has a lower message/body size limit than the configured 100 MB? Deployment must configure infrastructure (e.g. nginx, load balancer, WebSocket server) to allow at least the configured attachment size, or document the effective lower limit for the environment.

## Requirements _(mandatory)_

### Functional Requirements

**Incoming files (client → agent)**

- **FR-001**: The system MUST support arbitrary MIME types (not only image/\*) for attachments in the agent and chat.send RPCs: e.g. documents, PDF, audio, video, within configured limits.
- **FR-002**: The system MUST keep the current attachment format (e.g. base64 in a content field) for backward compatibility.
- **FR-003**: The system MUST support a configurable per-attachment size limit; default MUST be at least 100 MB. Aggregate size and max attachment count per request are optional (no default); when configured, they MUST be enforced and documented. The contract documents that deployers may set aggregate/count limits if needed.
- **FR-004**: The system SHOULD support attachment references: a parameter such as attachmentRefs: [{ url, mimeType?, fileName? }] for files available via HTTP/HTTPS; the Gateway fetches by URL and passes the content to the agent. Limits on size and number of URLs MUST be configurable.
- **FR-005**: The system SHOULD include the reason in validation error responses (e.g. type not allowed, size exceeded, invalid base64).

**Delivery to the agent**

- **FR-006**: The agent MUST receive attachments in a format suitable for the model and tools: e.g. base64 plus metadata (as for images today) or path to a temporary file after the Gateway resolves attachmentRefs. One consistent format for image and non-image (e.g. type, mimeType, fileName, data?, path?).
- **FR-007**: For non-image attachments, the agent MAY use them as context (text, metadata) or pass them to tools; usage is defined by the agent.

**Outgoing files (agent → client)**

- **FR-008**: In chat history, assistant messages MUST be able to include media: a list of attachments with fields such as type (e.g. text | file), text?, mimeType?, fileName?, and **content** (e.g. base64). Delivery is analogous to Telegram: the Gateway takes the local file from the agent and includes it in the RPC response so the orchestrator receives the file inline. The message format MUST keep reply text and file content separate: the message has a **text** field (the assistant’s reply text) and a **media** array (each element is a separate attachment with its own type, mimeType, fileName, content); text and binary content do not mix in one field. Optionally, mediaUrl may be present for very large files or external storage. Existing messages without media MUST remain backward compatible (text-only or current format).
- **FR-008a**: The system MUST support configurable limits for outgoing inline attachments: per-attachment size (default at least 100 MB); total size and max count per message/response are optional (no default). Defaults and maximums MUST be documented. Above a configured threshold, the system MAY use or require mediaUrl instead of inline content. MIME types for outgoing inline attachments MAY be restricted by configuration (allowlist/blocklist).
- **FR-009**: The system MAY provide, optionally, a dedicated RPC (e.g. chat.attachments.get) with parameters such as sessionKey and messageId/runId, returning a list of attachments with content and/or mediaUrl as per contract.
- **FR-010**: When content is used (default path), the client receives the file inline in the response; no separate download is required. When mediaUrl is used (e.g. for large files or external storage), it MUST be a URL from which the client can download the file—either provided by the agent or a Gateway endpoint; access control and TTL are documented if the Gateway serves the file.

**Contract and compatibility**

- **FR-010a**: The text field in assistant messages (e.g. in chat.history) MUST use a format compatible with the Telegram channel (e.g. the same markup or encoding that the Telegram send path uses), so the orchestrator can forward the message to Telegram without reformatting. The contract documents the chosen format (e.g. HTML, Markdown, or plain).
- **FR-011**: The system MUST preserve backward compatibility: clients that do not send new fields and do not expect media in responses MUST continue to work without change.
- **FR-012**: The contract MUST be documented: formats for attachments and attachmentRefs, limits, format of messages with media in chat.history (including reply text format for Telegram compatibility), and description of chat.attachments.get if introduced.

### Non-Functional Requirements

- **NFR-001**: Security: For attachmentRefs, allow only HTTPS (or a configurable allowlist of schemes). Verify size when downloading by URL; enforce timeout and redirect limits.
- **NFR-002**: Performance: Avoid loading the full RPC body into memory before validation; for large attachments use streaming or a bounded buffer.
- **NFR-003**: Observability: Log rejection of attachments (e.g. type or size) and validation or URL fetch errors without including sensitive content in logs.

### Key Entities

- **Attachment (inbound)**: Represents a file sent by the client; has type, mimeType, fileName, and content (e.g. base64) or reference (url). Subject to per-item and per-request size limits. Default MIME policy: accept types that Telegram allows for forwarding; optional allowlist/blocklist may further restrict or extend.
- **AttachmentRef**: Reference to a file by URL (e.g. url, optional mimeType, fileName); resolved by the Gateway under security and size constraints before delivery to the agent.
- **Message (assistant)**: Has a **text** field (reply text) and a **media** array; these are separate so text and file content do not mix. Each media item has type, optional text (e.g. caption), mimeType, fileName, and **content** (e.g. base64); optionally mediaUrl for large or external files. Backward compatible when media is absent.
- **Attachments list (outbound)**: Result of chat.attachments.get (if offered): identifiers and content and/or mediaUrl per attachment.

## Assumptions

- The orchestrator and other clients will be updated to use the new contract (reading media from chat.history and, if needed, calling chat.attachments.get).
- Default per-attachment limit is 100 MB (incoming and outgoing). At this size, infrastructure may impose constraints: WebSocket servers, reverse proxies (e.g. nginx `client_max_body_size`), and load balancers often default to smaller message/body limits (e.g. 1–10 MB). Deployment MUST configure these to allow at least the configured attachment limit (or document a lower effective limit). The system MUST NOT require loading the full RPC body into memory before validation (streaming or bounded buffer per NFR-002). For files beyond the configured limit, URL-based transfer (attachmentRefs or mediaUrl) is used.
- Default path: outgoing files are delivered inline in the RPC response (content in the message); no Gateway-served download URL or TTL is required. When mediaUrl is used (e.g. for very large files), storage and TTL for Gateway-served files are configuration-driven.
- The orchestrator forwards RPC responses (e.g. assistant messages from chat.history) to Telegram via its API; therefore reply text format in the RPC contract is aligned with what the Telegram channel expects (e.g. the format used by the existing Telegram send path).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Clients can send attachments of any supported MIME type (within limits) via the agent and chat.send RPCs; non-image attachments are not dropped and reach the agent in the agreed format.
- **SC-002**: Configurable size limits are enforced; when exceeded, the system returns a clear, machine- and human-readable error (e.g. reason code or message).
- **SC-003**: Assistant messages in chat history can include media with content (inline) and/or mediaUrl; the orchestrator receives files inline by default (like Telegram) or via URL/attachments RPC when used.
- **SC-004**: Existing clients that do not use new attachment or media features observe no behavioral change; the contract and limits are described in published documentation.
