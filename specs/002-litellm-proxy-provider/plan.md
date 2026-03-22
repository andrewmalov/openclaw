# Implementation Plan: LiteLLM Proxy Model Provider Integration

**Branch**: `002-litellm-proxy-provider` | **Date**: 2026-03-20 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/002-litellm-proxy-provider/spec.md`

## Summary

Add LiteLLM Proxy as a first-class model provider with the same runtime behavior as existing providers: configurable onboarding/setup, model catalog exposure, request routing, error handling, diagnostics, and compatibility with current provider flows. Implementation follows existing plugin/provider patterns: introduce a LiteLLM provider catalog extension, wire runtime provider discovery and auth resolution, and keep existing providers unaffected when LiteLLM is disabled.

## Technical Context

**Language/Version**: TypeScript (ESM), Node 22+  
**Primary Dependencies**: Existing provider runtime in `src/plugins/*`, model/provider config types in `src/config/*`, onboarding auth flow in `src/commands/*`, plugin-sdk provider contracts, existing OpenAI-compatible provider patterns (OpenRouter, custom, onboarding LiteLLM defaults)  
**Storage**: Existing OpenClaw config + auth profile storage; no new database  
**Testing**: Vitest with colocated `*.test.ts`; provider/runtime/auth-choice tests under `src/plugins` and `src/commands`  
**Target Platform**: OpenClaw CLI/runtime environments (local gateway + agent workflows)  
**Project Type**: Monorepo TypeScript CLI + plugin/provider runtime  
**Performance Goals**: No measurable regression in provider selection/request path; LiteLLM provider initialization and request path remain within existing provider-runtime expectations  
**Constraints**: Backward compatibility for existing providers/config, strict typing/no `any`, no prototype mutation, no new root-level dependency required  
**Scale/Scope**: One new provider integration path (LiteLLM) across onboarding, provider catalog, runtime resolution, and diagnostics

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Module and Structure**: Changes scoped to `src/` and `extensions/` provider paths; no new root-level plugin-only dependencies required.
- **II. CLI and Interface**: No new CLI surface needed; existing onboarding/config/model selection flows are extended consistently.
- **III. Test and Evidence**: Add/update colocated tests for provider registration, config validation, auth-choice wiring, and runtime resolution.
- **IV. Code Quality and Typing**: TypeScript strict mode preserved, no prototype mutation, existing style and patterns retained.
- **V. PR Truthfulness and Triage**: Scope is additive provider integration; no speculative bug-fix claims.

No exceptions required.

**Post-Design Re-check (after Phase 1 artifacts)**: PASS — `research.md`, `data-model.md`, `contracts/litellm-provider-contract.md`, and `quickstart.md` remain within constitution boundaries (module scope, no new CLI surface, defined testing strategy, strict typing expectations, no speculative scope).

## Project Structure

### Documentation (this feature)

```text
specs/002-litellm-proxy-provider/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── litellm-provider-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
extensions/
└── litellm/
    └── provider-catalog.ts          # New provider catalog builder (OpenAI-compatible)

src/
├── commands/
│   ├── onboard-auth.config-litellm.ts
│   ├── auth-choice.apply.api-key-providers.ts
│   └── onboard-non-interactive/
│       └── local/auth-choice.api-key-providers.ts
├── plugins/
│   ├── provider-catalog.ts
│   ├── provider-model-definitions.ts
│   ├── provider-runtime.ts
│   └── provider-auth-storage.ts
├── secrets/
│   └── provider-env-vars.ts
└── agents/
    └── model-catalog.ts
```

**Structure Decision**: Implement as an additive provider integration using existing provider runtime architecture, with LiteLLM-specific catalog logic in `extensions/litellm/` and orchestration in current `src/plugins` + `src/commands` flows.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| (none)    | —          | —                                    |
