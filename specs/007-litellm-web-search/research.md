# Research: LiteLLM Proxy for Web Search Tool

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## 1) Transport and API surface

**Decision**: Call LiteLLM Proxy using **OpenAI-compatible** `POST {LITELLM_API_BASE}/v1/chat/completions` with a **single user message** containing the search query (and optional system instructions internal to the implementation). The **model** parameter is the LiteLLM route name the operator configured (e.g. mapping to Perplexity, Tavily, or Brave upstream).

**Rationale**: LiteLLM is already the HOBOT LLM edge and is exposed as OpenAI-compatible in this repo’s model provider work (`002-litellm-proxy-provider`). Reusing chat completions avoids inventing a second client stack and matches how many search-capable models are exposed behind LiteLLM.

**Alternatives considered**:

- **Direct REST per vendor (Tavily/Brave native APIs) from OpenClaw** — Rejected for this feature: spec explicitly requires routing **through** LiteLLM Proxy and centralizing credentials there.
- **LiteLLM “search”-specific HTTP routes only** — Rejected as primary path: deployment-specific; chat completions is the portable contract across LiteLLM versions and provider mappings.

---

## 2) Credentials and base URL resolution

**Decision**:

- **API key**: Read from **`LITELLM_API_KEY`** (and existing secret-ref/config patterns for `tools.web.search` scoped key if we add `litellm.apiKey` for parity with other providers).
- **Base URL**: Read from **`LITELLM_API_BASE`** first (spec FR-002). **Fallback** (documented, not replacing env when set): `models.providers.litellm.baseUrl` and/or optional `tools.web.search.litellm.baseUrl` so operators who already configured LiteLLM for chat do not duplicate the base URL unless they want a different search endpoint.

**Rationale**: Matches stakeholder input and keeps parity with existing LiteLLM onboarding docs that emphasize `LITELLM_API_KEY`.

**Alternatives considered**:

- **Base URL only from `models.providers.litellm`** — Rejected as insufficient: spec requires **`LITELLM_API_BASE`** in the agent environment for container deployments that inject env without full config merge.
- **OAuth to LiteLLM** — Out of scope; API key is the existing pattern.

---

## 3) Provider registration and auto-detect precedence

**Decision**: Register a bundled **`extensions/litellm`** plugin that calls `registerWebSearchProvider` with `id: "litellm"` and `envVars: ["LITELLM_API_KEY"]`. Auto-detect considers the provider **eligible only when both** key and resolvable base URL are present (otherwise skip without error so other providers can win). When **`tools.web.search.provider` is `litellm`**, require both; surface clear configuration errors if one is missing.

**Precedence when env is set**: Spec User Story 3 requires proxy path to take precedence when proxy variables are set. **Concrete rule**: If `LITELLM_API_KEY` and `LITELLM_API_BASE` are both set and `tools.web.search.provider` is **unset**, prefer **`litellm`** ahead of lower-priority bundled providers (choose an `autoDetectOrder` **lower** than incumbents such as Perplexity’s 50—e.g. **10**—after verifying no collision with Brave/Firecrawl ordering).

**Rationale**: Satisfies FR-007 (no env → unchanged) and Story 3 (env set → proxy path preferred) without breaking explicit `provider: brave|...` configs.

**Alternatives considered**:

- **Always prefer Perplexity when `PERPLEXITY_API_KEY` exists** — Rejected: conflicts with “proxy takes precedence” when LiteLLM env is set.
- **Implicit litellm without plugin registration** — Rejected: breaks onboarding/provider listing and runtime credential diagnostics consistency.

---

## 4) Response normalization

**Decision**: Normalize successful LiteLLM responses into **existing** `web_search` payloads:

- **Primary**: If assistant `content` is **JSON** matching a small internal schema (optional operator convention), map to **`results[]`** (`url`, `title`, `snippets[]`) like Brave/Perplexity Search API path.
- **Fallback**: Treat assistant text like the **Perplexity chat-completions** path: `content` (wrapped) + **`citations`** extracted from URLs (e.g. markdown links, `http(s)://` tokens, or provider-specific citation arrays if present in the chat payload).

**Rationale**: FR-004 requires the same agent-visible shapes; agents already handle both “structured results” and “content + citations” styles.

**Alternatives considered**:

- **Pass through raw LiteLLM JSON to the agent** — Rejected: violates FR-004.
- **Require LiteLLM response_format JSON schema for all deployments** — Rejected: too strict for MVP; offer as optional optimization later.

---

## 5) Observability and errors

**Decision**: Reuse existing runtime **diagnostics** patterns (`RuntimeWebDiagnostic`) for invalid provider, missing key/base, and auto-detect selection. Map HTTP status and LiteLLM error bodies to **FR-005** classes without echoing `LITELLM_API_KEY`.

**Rationale**: Consistent with `runtime-web-tools.ts` and spec FR-006.

---

## 6) Testing strategy

**Decision**: Colocated Vitest with **mocked `fetch`** (or existing guarded fetch test hooks) for LiteLLM success, empty content, 401/404/429/timeout. Integration-style test for **auto-detect order** with env matrix.

**Rationale**: Constitution III; no live LiteLLM required in CI.

**Alternatives considered**:

- **Live LiteLLM tests only** — Rejected: flaky CI; optional `LIVE=1` path acceptable later.
