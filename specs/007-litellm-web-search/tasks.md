# Tasks: LiteLLM Proxy for Web Search Tool

**Input**: Design documents from `/specs/007-litellm-web-search/`  
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/README.md](./contracts/README.md)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no hard dependencies)
- **[Story]**: User story from [spec.md](./spec.md) (`US1`–`US3`)
- Paths are repo-root relative

---

## Phase 1: Extension & Registration (Setup)

**Purpose**: Bundled `litellm` web-search plugin and repo wiring.

- [ ] T001 Create `extensions/litellm/` with `package.json` (follow `extensions/brave/package.json` / `openclaw` peer pattern), `openclaw.plugin.json`, and `index.ts` calling `registerWebSearchProvider` with `id: "litellm"`, `envVars` including `LITELLM_API_KEY`, `autoDetectOrder: 10` (per [research.md](./research.md)), and scoped credential `getCredentialValue` / `setCredentialValue` for `tools.web.search.litellm.apiKey`
- [ ] T002 Register the litellm plugin in `src/plugins/web-search-providers.ts` (`BUNDLED_WEB_SEARCH_PLUGINS`)
- [ ] T003 [P] Add `"extensions: litellm"` entry to `.github/labeler.yml` targeting `extensions/litellm/**`
- [ ] T004 [P] **Maintainer**: Create GitHub label **`extensions: litellm`** (match existing `extensions: *` label colors) if it does not exist — constitution I

---

## Phase 2: Config & Runtime Resolution (Foundational)

**Purpose**: Schema, types, env mapping, and runtime selection rules. **Blocks user-story integration** until complete.

- [ ] T005 [P] Extend `ToolsWebSearchSchema` in `src/config/zod-schema.agent-runtime.ts`: add `z.literal("litellm")` to `tools.web.search.provider`; add optional `litellm` object (`apiKey`, `baseUrl`, `model`) with `.strict()`
- [ ] T006 [P] Update `WebSearchConfig` (and related exports) in `src/config/types.tools.ts` for `litellm` nested settings
- [ ] T007 [P] Add `schema.labels.ts` and `schema.help.ts` strings for `tools.web.search.litellm.*` and provider `litellm`
- [ ] T008 [P] Extend `src/secrets/provider-env-vars.ts` and any auth/onboarding env lists that should mention **`LITELLM_API_BASE`** alongside existing LiteLLM key mapping
- [ ] T009 [P] Optionally extend `RuntimeWebSearchMetadata` in `src/secrets/runtime-web-tools.types.ts` (e.g. effective model / base source) for diagnostics — only if needed for UX or tests
- [ ] T010 Update `src/secrets/runtime-web-tools.ts`: treat **`litellm` as eligible for auto-detect only when both API key and base URL resolve** — base from `context.env.LITELLM_API_BASE` first, then `tools.web.search.litellm.baseUrl`, then `models.providers.litellm.baseUrl` per [research.md](./research.md); emit diagnostics when `provider: "litellm"` is configured but base URL is missing

**Checkpoint**: Config validates; runtime can resolve credentials and base without logging secrets.

---

## Phase 3: User Story 1 — Route Web Search Through LiteLLM Proxy (Priority: P1) MVP

**Goal**: With `LITELLM_API_KEY` + resolvable base, `web_search` hits LiteLLM OpenAI-compatible chat completions and returns normalized results or clear errors.

**Independent Test**: Set env + `tools.web.search.provider: litellm` (or auto-detect), invoke `web_search`, get structured success or explicit failure (no hang, no secret leakage).

### Implementation for User Story 1

- [ ] T011 [US1] Add `"litellm"` to `SEARCH_PROVIDERS` and wire `createWebSearchTool` → `runWebSearch` in `src/agents/tools/web-search-core.ts`: build `POST {base}/v1/chat/completions` request with configurable **model** and user message from query; reuse existing timeout/cache/`withTrustedWebSearchEndpoint` patterns where applicable
- [ ] T012 [US1] Normalize LiteLLM responses to existing payloads: prefer parsing JSON assistant content into **`results[]`** when possible; otherwise **`content` + `citations`** (mirror Perplexity chat-style) per [contracts/README.md](./contracts/README.md)
- [ ] T013 [US1] On missing key or missing base when `provider === "litellm"`, return the same class of **`missingSearchKeyPayload` / configuration errors** used by other providers — never echo `LITELLM_API_KEY` (FR-006)

**Checkpoint**: US1 happy path + misconfiguration path behave per spec acceptance scenarios 1–2.

---

## Phase 4: User Story 2 — Select LiteLLM Search Route / Model (Priority: P2)

**Goal**: Operator-chosen LiteLLM model name is sent on every request; invalid/disabled upstream surfaces a clear error.

**Independent Test**: Two config models (mocked) produce different request bodies; 404/invalid model returns actionable error.

### Implementation for User Story 2

- [ ] T014 [US2] Resolve **model** from `tools.web.search.litellm.model` (required when using `litellm`, or document default in `schema.help.ts` if a safe default is chosen)
- [ ] T015 [US2] Handle **empty assistant content**, malformed JSON, and LiteLLM/upstream **model not found** responses with explicit, non-stuck failures (spec edge cases)

**Checkpoint**: US2 acceptance scenarios satisfied under mocked HTTP.

---

## Phase 5: User Story 3 — Coexist With Non-Proxy Search (Priority: P2)

**Goal**: No LiteLLM env → unchanged provider behavior; explicit non-litellm provider ignores LiteLLM env; unset provider + both env vars → litellm preferred per research precedence.

**Independent Test**: Env and `tools.web.search.provider` matrix in tests.

### Implementation for User Story 3

- [ ] T016 [US3] Verify and test: **`tools.web.search.provider` explicitly set** to `brave` | `perplexity` | … **forces that provider** even if `LITELLM_API_KEY` and `LITELLM_API_BASE` are set
- [ ] T017 [US3] Verify and test: when **provider is unset**, **both** `LITELLM_API_KEY` and **`LITELLM_API_BASE`** resolve, **`litellm` is auto-selected** ahead of providers with higher `autoDetectOrder` (e.g. Perplexity at 50)

**Checkpoint**: US3 acceptance scenarios covered by automated tests.

---

## Phase 6: Automated Tests

**Purpose**: Regression and evidence (constitution III).

- [ ] T018 [P] [US1] Add Vitest coverage in `src/agents/tools/web-search-core.test.ts` (or colocated helper test file) for **mocked** LiteLLM success: normalized `results` or `content`+`citations`
- [ ] T019 [P] [US1] Add tests for **401/404/timeout** → safe error payloads (no secret substrings)
- [ ] T020 [P] [US2] Add test that **`tools.web.search.litellm.model`** appears in the JSON body sent to `/v1/chat/completions`
- [ ] T021 [P] [US3] Extend `src/secrets/runtime-web-tools.test.ts` (or equivalent) for **auto-detect vs explicit provider** env/config matrix

---

## Phase 7: Operator UX & Docs

**Purpose**: FR-008 onboarding and discoverability.

- [ ] T022 [P] Update `src/commands/onboard-search.ts` (and any shared provider list utilities) so **LiteLLM** appears in web-search provider flows consistently with other bundled providers
- [ ] T023 [P] Update `docs/providers/litellm.md` with a **Web search** section: `LITELLM_API_KEY`, `LITELLM_API_BASE`, `tools.web.search` example, pointer to LiteLLM route configuration (English only; zh-CN via `scripts/docs-i18n` if required by repo process)
- [ ] T024 [P] Reconcile `specs/007-litellm-web-search/quickstart.md` with shipped config keys and defaults after implementation

---

## Phase 8: Verification

- [ ] T025 Run `pnpm check` and `pnpm test` (or scoped `pnpm test -- <filter>`) for all touched modules; fix failures
- [ ] T026 **Manual smoke** (optional for merge, required for operator sign-off): live LiteLLM with a search-mapped model; record outcome in PR description

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** → no prerequisites
- **Phase 2** → depends on Phase 1 (provider id must exist for schema/runtime to align)
- **Phases 3–5** → depend on Phase 2
- **Phase 6** → depends on Phases 3–5 (tests exercise implemented behavior)
- **Phase 7** → can start after Phase 3 for early docs; finalize after Phase 5–6
- **Phase 8** → last

### Parallel Opportunities

- T003, T005, T006, T007, T008, T009 can run in parallel once T001 structure exists
- T018–T021 parallel after core implementation lands
- T022–T024 parallel in Phase 7

### MVP Scope

1. Complete Phases 1–2
2. Complete Phase 3 (US1) + minimal tests from T018–T019
3. **STOP**: validate US1 independently (quickstart)
4. Add Phases 4–5 and remaining tests, then docs and Phase 8

---

## Notes

- Do not log or assert on raw `LITELLM_API_KEY` in test output beyond masked fixtures
- Prefer `scripts/committer` for scoped commits per repo guidelines
- If `setup-plan.sh` overwrote `plan.md`, restore from git history or re-run `/speckit.plan` fill-in before diverging from [plan.md](./plan.md)
