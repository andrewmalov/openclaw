# Data Model: LiteLLM Web Search

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Configuration (operator-facing)

| Field                              | Source            | Description                                         | Validation                                                                                         |
| ---------------------------------- | ----------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `tools.web.search.enabled`         | Config            | Master toggle for `web_search`                      | Boolean; existing rules                                                                            |
| `tools.web.search.provider`        | Config            | Explicit provider id                                | Must include `litellm` when selected; invalid values fall back with diagnostic (existing behavior) |
| `tools.web.search.litellm.model`   | Config (optional) | LiteLLM model/route name for search                 | Non-empty string when provider is `litellm`                                                        |
| `tools.web.search.litellm.baseUrl` | Config (optional) | Override base URL                                   | Valid HTTP(S) URL; used only if env base missing                                                   |
| `LITELLM_API_KEY`                  | Agent environment | Proxy API key                                       | Non-empty when using `litellm`                                                                     |
| `LITELLM_API_BASE`                 | Agent environment | Proxy root URL (e.g. `https://litellm.example.com`) | Must resolve to prefix for `/v1/chat/completions`                                                  |

## Runtime metadata (`RuntimeWebSearchMetadata` extensions)

Optional fields (if needed for diagnostics/UI):

| Field               | Type                             | Description                            |
| ------------------- | -------------------------------- | -------------------------------------- |
| `litellmBaseSource` | `"env" \| "config" \| "missing"` | Where base URL was resolved from       |
| `litellmModel`      | `string` (optional)              | Effective model name used for the call |

Existing fields continue to apply: `selectedProvider`, `selectedProviderKeySource`, `providerSource`, `diagnostics[]`.

## Tool invocation: Web Search Request

| Attribute       | Description                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Query           | Required string from tool args                                                                                             |
| Count / filters | Existing tool parameters; **may be ignored** by LiteLLM path if upstream does not support them (document in operator docs) |
| Provider        | Resolved to `litellm` when configured or auto-detected                                                                     |
| Routing         | Proxy vs non-proxy per precedence rules in [research.md](./research.md)                                                    |

## Tool result: Search Result Set (normalized)

Success payloads MUST conform to one of the **existing** shapes already returned by `web_search`:

1. **Structured**: `{ query, provider, count, tookMs, results: [{ url, title, snippets[], siteName? }], externalContent, ... }`
2. **Chat-like**: `{ query, provider, model?, tookMs, content, citations?, externalContent, ... }`

Failure payloads: existing error JSON style (`error`, `message`, optional `docs`) with **no secrets**.

## State transitions

- **Config load** → runtime snapshot resolves provider + secrets → metadata recorded.
- **Tool execute** → cache lookup (key includes provider + model + base + query + relevant args) → HTTP to LiteLLM → normalize → cache write.

## Relationships

- **LiteLLM Proxy Configuration** (spec entity) ↔ config/env fields above.
- **Inference/model provider LiteLLM** (`models.providers.litellm`) ↔ optional fallback for base URL only; search model name is independent unless operator reuses the same virtual model.
