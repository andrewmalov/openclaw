# Contracts: LiteLLM Web Search

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This feature adds **no new public HTTP API** on OpenClaw. Contracts below describe **outbound** calls to LiteLLM and **inbound** tool result shapes consumed by agents.

## Outbound: LiteLLM OpenAI chat completions

**Endpoint**: `POST {LITELLM_API_BASE}/v1/chat/completions`  
**Headers**: `Authorization: Bearer {LITELLM_API_KEY}`, `Content-Type: application/json`  
**Body** (conceptual):

```json
{
  "model": "<operator-configured-route-name>",
  "messages": [{ "role": "user", "content": "<search query>" }],
  "temperature": 0
}
```

Optional fields (implementation may add): `max_tokens`, internal system message for “return citations” — must not leak operator secrets.

**Success response**: Subset of OpenAI chat completion schema; implementation reads `choices[0].message.content` and optional provider-specific citation payloads if present.

**Error response**: HTTP status + JSON `error` object; map to user-safe messages.

## Inbound: `web_search` tool success payload

Normalized payloads MUST match one of the shapes already produced today (examples abbreviated):

### Structured results

```json
{
  "query": "string",
  "provider": "litellm",
  "count": 0,
  "tookMs": 0,
  "results": [{ "url": "https://...", "title": "string", "snippets": ["string"] }],
  "externalContent": {
    "untrusted": true,
    "source": "web_search",
    "provider": "litellm",
    "wrapped": true
  }
}
```

### Chat-like (content + citations)

```json
{
  "query": "string",
  "provider": "litellm",
  "model": "string",
  "tookMs": 0,
  "content": "<wrapped string>",
  "citations": [{ "url": "https://...", "title": "string" }],
  "externalContent": {
    "untrusted": true,
    "source": "web_search",
    "provider": "litellm",
    "wrapped": true
  }
}
```

## Inbound: `web_search` tool failure payload

```json
{
  "error": "configuration_error | upstream_error | timeout | ...",
  "message": "operator-safe string",
  "docs": "https://github.com/andrewmalov/openclaw"
}
```

No raw API keys or `Authorization` headers in any field.
