# Implementation Plan: LiteLLM Voice Messages

**Branch**: `008-litellm-voice-messages` | **Date**: 2026-03-30 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/008-litellm-voice-messages/spec.md`

## Summary

Add end-to-end voice message support through LiteLLM by covering both directions: (1) speech recognition for inbound voice notes and (2) speech generation for outbound assistant replies. The default audio model for both paths is `gpt-4o-audio-preview`, with explicit operator overrides preserved. Existing non-voice flows remain unchanged when voice is disabled or unsupported.

## Technical Context

**Language/Version**: TypeScript (ESM), Node 22+  
**Primary Dependencies**: Existing media-understanding runtime (`src/media-understanding/*`), existing TTS runtime (`src/tts/*`), LiteLLM bundled plugin (`extensions/litellm/*`), provider config schemas (`src/config/types.tools.ts`, `src/config/zod-schema.agent-runtime.ts`)  
**Storage**: No new persistent storage; reuse existing session/transcript artifacts and temporary media files  
**Testing**: Vitest colocated `*.test.ts` in touched modules and extension tests  
**Target Platform**: OpenClaw agent runtime (local + gateway) with media-capable channels  
**Project Type**: OpenClaw core + bundled extension updates  
**Performance Goals**: Voice transcription and voice generation complete within existing media/TTS timeout envelopes; no regression in non-voice turns  
**Constraints**: Must not leak secrets; must preserve backward compatibility for current `tools.media.audio` and `messages.tts` behavior  
**Scale/Scope**: One bundled provider enhancement (`litellm`) plus default-model wiring and diagnostics for audio-in/audio-out

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Project Vision (HOBOT)**: Pass — feature routes voice capabilities through LiteLLM Proxy, matching HOBOT architecture.
- **I. Module and Structure**: Pass — changes stay under `src/` and `extensions/litellm/`; no new root dependency required.
- **II. CLI and Interface**: Pass — no new CLI command surface; existing config and channel output paths are reused.
- **III. Test and Evidence**: Pass — add targeted Vitest coverage for default model selection, fallback behavior, and error mapping.
- **IV. Code Quality and Typing**: Pass — strict TypeScript modules only; no prototype mutation.
- **V. PR Truthfulness and Triage**: Pass — additive feature, no speculative bug-fix claims.

**Post-design re-check**: Pass — design artifacts introduce no constitution violations.

## Project Structure

### Documentation (this feature)

```text
specs/008-litellm-voice-messages/
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
├── index.ts
└── media-understanding-provider.ts          # new: audio transcription provider wiring

src/
├── media-understanding/
│   ├── providers/openai-compatible-audio.ts # reuse openai-compatible transcription client
│   ├── runner.ts
│   └── runtime.ts
├── tts/
│   ├── tts.ts                               # default model/base-url resolution
│   ├── tts-core.ts
│   └── providers/openai.ts
├── config/
│   ├── types.tools.ts
│   ├── zod-schema.agent-runtime.ts
│   ├── schema.labels.ts
│   └── schema.help.ts
└── plugins/
    └── web-search-providers.ts              # no functional changes expected; reference only if provider registration is shared
```

**Structure Decision**: Keep implementation inside existing media-understanding and TTS pipelines, and extend bundled `extensions/litellm` for audio-transcription capability so the feature remains consistent with current provider registration patterns.

## Complexity Tracking

_Not required — no constitution violations._

## Phases

### Phase 0 — Research

Complete: [research.md](./research.md) (default model policy, LiteLLM base URL precedence, inbound/outbound integration path, failure handling).

### Phase 1 — Design artifacts

Complete: [data-model.md](./data-model.md), [contracts/README.md](./contracts/README.md), [quickstart.md](./quickstart.md). Agent context update command: `SPECIFY_FEATURE=008-litellm-voice-messages .specify/scripts/bash/update-agent-context.sh cursor-agent`.

### Phase 2 — Implementation (for `/speckit.tasks`)

1. Add LiteLLM media-understanding provider wiring for audio transcription in `extensions/litellm`.
2. Wire default model `gpt-4o-audio-preview` for LiteLLM transcription path when no override is configured.
3. Add TTS default model routing for LiteLLM-backed OpenAI-compatible endpoint and keep config override behavior intact.
4. Ensure robust error mapping and fallback text behavior on audio generation delivery failures.
5. Update config docs/labels/help for new or clarified LiteLLM voice settings if required.
6. Add/expand tests for model resolution, env/config precedence, and non-voice regression safety.

### Phase 3 — Verification

Run `pnpm check` and targeted `pnpm test -- <path-or-filter>` for touched media-understanding, TTS, and extension files; validate one manual voice-in and one voice-out smoke path with LiteLLM env configured.
