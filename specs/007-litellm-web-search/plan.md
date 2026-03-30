# Implementation Plan: LiteLLM Proxy for Web Search Tool

**Branch**: `007-litellm-web-search` | **Date**: 2026-03-29 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/007-litellm-web-search/spec.md`

**Note**: `.specify/scripts/bash/setup-plan.sh` copies the empty template over `plan.md` on every run. After setup, this file must be re-filled from [spec.md](./spec.md), [research.md](./research.md), and the constitution.

## Summary

Add a **`litellm` web search provider** so the `web_search` tool can call search-capable upstreams (Perplexity, Tavily, Brave, and others) **through LiteLLM Proxy**, using operator-supplied **`LITELLM_API_KEY`** and **`LITELLM_API_BASE`** in the agent environment. Requests use the **OpenAI-compatible chat-completions** surface (`POST {base}/v1/chat/completions`); operators map logical model names to search routes in LiteLLM. Successful responses are **normalized** to the same JSON shapes already produced for other providers (`results[]` and/or `content` + `citations`). When LiteLLM env is unset or another provider is explicitly selected, **existing behavior is unchanged**.

## Technical Context

**Language/Version**: TypeScript (ESM), Node 22+  
**Primary Dependencies**: Existing `web_search` stack (`src/agents/tools/web-search-core.ts`, `src/web-search/runtime.ts`), bundled web-search plugins (`src/plugins/web-search-providers.ts`, `extensions/*`), secrets/runtime resolution (`src/secrets/runtime-web-tools.ts`, `src/secrets/runtime-web-tools.types.ts`), config Zod (`src/config/zod-schema.agent-runtime.ts`, `src/config/types.tools.ts`)  
**Storage**: No new persistence; reuse existing in-memory web search cache where applicable  
**Testing**: Vitest, colocated `*.test.ts` (`src/agents/tools/web-search*.test.ts`, `src/secrets/runtime-web-tools.test.ts`, extension tests if added)  
**Target Platform**: Agent runtime (gateway/local) where `web_search` executes  
**Project Type**: OpenClaw core + bundled extension provider registration  
**Performance Goals**: Align with spec SC-001: completed outcomes within 30s under normal conditions (existing timeout/cache knobs)  
**Constraints**: No secret leakage (FR-006); backward-compatible non-proxy path (FR-007)  
**Scale/Scope**: One provider id (`litellm`) + config/env wiring + response mapping

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

- **Project Vision (HOBOT)**: Aligns with HOBOT: agents use **LiteLLM Proxy** as the shared edge; routing `web_search` through the same proxy matches the architecture.
- **I. Module and Structure**: **Bundled extension** `extensions/litellm/` for `registerWebSearchProvider` (same pattern as Perplexity/Brave) plus execution branch in `src/agents/tools/web-search-core.ts`. Plugin-only deps stay in the extension `package.json`. Adding a new bundled extension: update **`.github/labeler.yml`** and ensure a matching **GitHub label** exists (constitution I).
- **II. CLI and Interface**: Surface the provider in onboarding/search listings (`src/commands/onboard-search.ts`, schema help/labels). Use shared CLI patterns for any new status output.
- **III. Test and Evidence**: Colocated Vitest with mocked HTTP; regression coverage for env precedence and non-proxy path.
- **IV. Code Quality and Typing**: Strict TypeScript; no prototype mutation; focused helpers.
- **V. PR Truthfulness and Triage**: Additive scope; evidence-based tests for new paths.

**Post-design**: No violations requiring Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/007-litellm-web-search/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── README.md
├── checklists/
│   └── requirements.md
└── spec.md
```

### Source Code (repository root)

```text
extensions/litellm/
├── index.ts                 # registerWebSearchProvider: id litellm, env vars, autoDetectOrder
├── package.json
└── openclaw.plugin.json

src/
├── agents/tools/
│   ├── web-search-core.ts   # SEARCH_PROVIDERS + runWebSearch branch + LiteLLM client helper
│   └── web-search-core.test.ts
├── config/
│   ├── zod-schema.agent-runtime.ts
│   ├── types.tools.ts
│   └── schema.labels.ts / schema.help.ts
├── secrets/
│   ├── runtime-web-tools.ts
│   ├── runtime-web-tools.types.ts
│   └── provider-env-vars.ts
├── plugins/
│   └── web-search-providers.ts
├── commands/
│   └── onboard-search.ts
└── docs/providers/
    └── litellm.md
```

**Structure Decision**: Bundled extension registers the provider; core implements the LiteLLM HTTP call and normalizes responses (mirrors Brave/Perplexity split).

## Complexity Tracking

_Not required — no constitution violations._

## Phases

### Phase 0 — Research

Complete: [research.md](./research.md) (transport, env precedence, auto-detect order, normalization, testing).

### Phase 1 — Design artifacts

Complete: [data-model.md](./data-model.md), [contracts/README.md](./contracts/README.md), [quickstart.md](./quickstart.md). Agent context: `SPECIFY_FEATURE=007-litellm-web-search .specify/scripts/bash/update-agent-context.sh cursor-agent`.

### Phase 2 — Implementation (for `/speckit.tasks`)

1. Add `extensions/litellm` and register in `src/plugins/web-search-providers.ts`.
2. Extend config schema/types for `provider: litellm` and `tools.web.search.litellm.*`.
3. Implement `runWebSearch` branch + `LITELLM_API_BASE` resolution (env → config fallbacks).
4. Wire `resolveRuntimeWebTools` / credentials without logging secrets.
5. Docs + onboarding provider list.
6. Tests (mocked fetch, precedence, errors).

### Phase 3 — Verification

`pnpm check`, `pnpm test` on touched paths; manual smoke against a LiteLLM route mapped to a search upstream.
