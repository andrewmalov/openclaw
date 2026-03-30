# Feature Specification: LiteLLM Proxy for Web Search Tool

**Feature Branch**: `007-litellm-web-search`  
**Created**: 2026-03-29  
**Status**: Draft  
**Input**: User description: "добавить поддержку работы через litellm proxy для perplexity и других провайдеров поиска для инструмента web_search например tavily, brave и др. Ключи LiteLLM в среде агента: LITELLM_API_KEY, LITELLM_API_BASE."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Route Web Search Through LiteLLM Proxy (Priority: P1)

As an operator, I can point the agent’s web search capability at a LiteLLM Proxy deployment that fronts search-oriented providers (for example Perplexity, Tavily, or Brave Search), so one gateway handles credentials and provider choice upstream while the agent uses a single, consistent search path.

**Why this priority**: Without proxy-backed routing, operators cannot centralize search keys and models or reuse LiteLLM’s provider catalog for the `web_search` tool.

**Independent Test**: Configure proxy endpoint and credentials in the agent environment, invoke `web_search` with a simple query, and confirm results are returned from the proxy-backed search path when that mode is enabled.

**Acceptance Scenarios**:

1. **Given** valid proxy base URL and API key are present in the agent environment, **When** an agent run invokes `web_search`, **Then** the tool completes using the configured proxy and returns normalized search results (or a clear empty-result outcome).
2. **Given** proxy credentials or base URL are missing or invalid, **When** `web_search` is invoked in proxy mode, **Then** the user or operator sees a clear error that distinguishes configuration problems from query or upstream failures.

---

### User Story 2 - Select Among Search Backends Exposed by LiteLLM (Priority: P2)

As an operator, I can align the agent’s search behavior with the models or routes I define in LiteLLM (for example different virtual models for Tavily vs Brave vs Perplexity), so the same agent stack can switch search backends without changing agent code.

**Why this priority**: Operators often standardize on LiteLLM to map logical model names to upstream search APIs.

**Independent Test**: With two distinct search routes configured in LiteLLM, run `web_search` twice with configuration or naming that selects each route, and verify responses reflect the intended backend (for example via distinct result shape or documented test fixtures).

**Acceptance Scenarios**:

1. **Given** LiteLLM exposes multiple search-capable model names, **When** the operator selects or configures a specific model or route for `web_search`, **Then** requests use that selection consistently for subsequent searches in the same session configuration.
2. **Given** a selected LiteLLM route is disabled or renamed, **When** `web_search` runs, **Then** the failure is reported clearly and does not leave the tool in a stuck or silent state.

---

### User Story 3 - Coexist With Non-Proxy Web Search (Priority: P2)

As an operator, I can keep using direct provider or built-in web search behavior when the proxy is not configured, so adoption is optional and existing deployments keep working.

**Why this priority**: Reduces migration risk and supports mixed environments.

**Independent Test**: Run `web_search` with proxy settings unset and confirm prior default behavior still works; then enable proxy settings and confirm traffic switches without requiring unrelated configuration changes.

**Acceptance Scenarios**:

1. **Given** proxy environment variables are unset and legacy/direct search is supported, **When** `web_search` runs, **Then** behavior matches the documented non-proxy path.
2. **Given** proxy variables are set, **When** `web_search` runs, **Then** the proxy path takes precedence according to documented precedence rules.

---

### Edge Cases

- LiteLLM returns success with an empty body or no parseable results.
- Upstream search provider rate limits or quota errors surface through LiteLLM.
- Network timeouts between agent and LiteLLM or between LiteLLM and upstream search APIs.
- Very long queries or result payloads exceed safe size limits for the tool response.
- Mismatch between configured model or route name and what LiteLLM currently advertises.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST support routing `web_search` tool requests through LiteLLM Proxy when operator-supplied connection settings are present in the agent runtime environment.
- **FR-002**: The system MUST read proxy authentication and endpoint location from the agent environment using the variable names `LITELLM_API_KEY` and `LITELLM_API_BASE`.
- **FR-003**: The system MUST allow operators to select or name the LiteLLM-backed search model or route used by `web_search` in a way consistent with existing configuration patterns for models (exact mechanism follows platform conventions documented for this feature).
- **FR-004**: The system MUST normalize successful search outcomes into the same user- and agent-visible result shape used for non-proxy `web_search`, so downstream prompts and tools do not require special cases for proxy mode.
- **FR-005**: The system MUST surface clear, non-sensitive errors for proxy connectivity, authentication, timeout, and “model or route not found” conditions.
- **FR-006**: The system MUST not log or echo raw secrets from `LITELLM_API_KEY` in user-visible output or routine diagnostic logs.
- **FR-007**: When proxy settings are absent or proxy mode is disabled, the system MUST preserve existing `web_search` behavior without requiring LiteLLM.
- **FR-008**: The system MUST document operator setup for LiteLLM-backed search, including required environment variables, how to map Perplexity/Tavily/Brave (and similar) in LiteLLM, and how to verify end-to-end search from an agent run.

### Key Entities _(include if feature involves data)_

- **Web Search Request**: A tool invocation carrying a query, optional parameters supported by the tool, and runtime context for routing (proxy vs non-proxy).
- **LiteLLM Proxy Configuration**: Operator-supplied base URL and API key available in the agent environment, plus any named model or route identifier used for search.
- **Search Result Set**: Normalized list of findings (title, snippet, URL or equivalent) returned to the agent regardless of upstream provider.
- **Routing Precedence**: Documented rules for when proxy-backed search is used versus legacy or direct paths.

## Assumptions

- LiteLLM Proxy is deployed and reachable from the same environment where the agent executes, with search providers already registered in LiteLLM per operator choice.
- Perplexity, Tavily, Brave Search, and similar services are configured upstream of LiteLLM by the operator; this feature focuses on the agent’s use of LiteLLM for `web_search`, not on provisioning those vendor accounts.
- `LITELLM_API_BASE` points to the proxy base URL format documented for LiteLLM usage in this product (consistent with the LiteLLM model provider integration where applicable).
- Operators who want both chat models and search via LiteLLM may reuse the same proxy deployment; credential variable names match the stated convention for the agent environment.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In acceptance testing, at least 95% of `web_search` invocations with valid proxy configuration return a completed outcome (results or explicit empty) within 30 seconds under normal network conditions.
- **SC-002**: Operators can follow documentation to enable proxy-backed `web_search` using only environment-supplied endpoint and key, and complete a successful test query in one sitting without developer assistance.
- **SC-003**: With proxy settings unset, existing `web_search` acceptance scenarios continue to pass at the same rate as before this feature (no regression in pass rate for the non-proxy path).
- **SC-004**: For failed proxy-backed searches, 100% of failures in testing produce an operator- or user-visible message that indicates failure class (configuration, connectivity, authentication, timeout, or upstream) without exposing secret material.
