# Implementation Plan: Webchat default channel for orchestrator agent

**Branch**: `003-webchat-default-priority` | **Date**: 2026-03-22 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/003-webchat-default-priority/spec.md`

## Summary

HOBOT operators primarily use **orchestrator webchat** (Gateway client mode webchat / internal channel `webchat`). Today the agent `message` tool resolves outbound channel via `resolveMessageChannelSelection`, which only treats **plugin deliverable** channels as valid. The internal `webchat` surface is excluded from that list, and `listConfiguredMessageChannels` ignores it. When no Telegram/Discord/etc. accounts are configured, channel resolution throws **“Channel is required (no configured channels detected)”** before `runMessageAction` can apply the existing **webchat inline relay** path (media/file back to the orchestrator UI).

**Technical approach**: Treat **webchat as a first-class default** when tool context indicates a webchat-originated session: extend channel selection (and any related typing) so `fallbackChannel` / `currentChannelProvider === webchat` resolves to `webchat` without requiring external channel configuration. Preserve explicit `channel` in tool args and multi-channel disambiguation when external channels exist. Align agent-facing **message tool** description/schema hints so models default to `target=webchat` (and media params) for “send here” flows. **Coordination with `001-gateway-rpc-file-transfer`**: that effort ensures inline-relay media reaches `chat.history`; this plan removes the **selection** blocker so the relay path can execute. Add **Vitest** coverage for webchat-only config + webchat fallback selection + send with media.

## Technical Context

**Language/Version**: TypeScript (ESM), Node 22+  
**Primary Dependencies**: Existing Gateway + agent stack; `src/infra/outbound/channel-selection.ts`, `src/infra/outbound/message-action-runner.ts`, `src/infra/outbound/channel-resolution.ts`, `src/agents/tools/message-tool.ts`, `src/utils/message-channel.ts` (`INTERNAL_MESSAGE_CHANNEL`, `listGatewayMessageChannels`)  
**Storage**: No new persistence; session/transcript behavior unchanged except successful delivery paths.  
**Testing**: Vitest; extend `src/infra/outbound/channel-selection.test.ts` and message-tool / gateway-agent tests as appropriate; optional integration-style test for `runMessageAction` webchat + media when toolContext is webchat.  
**Target Platform**: Gateway-backed agent runs (orchestrator RPC → container agent).  
**Project Type**: Monorepo core (`src/`).  
**Performance Goals**: No extra full-file reads in channel selection; existing media paths keep size/policy limits.  
**Constraints**: Must not weaken cross-context or multi-channel security policies; explicit user intent for another surface must still win when configured (spec FR-004).  
**Scale/Scope**: Single-operator webchat sessions; mixed deployments with external channels.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Project Vision (HOBOT)**: Aligns with orchestrator ↔ RPC ↔ OpenClaw container; webchat is the default operator surface in that flow. No conflict with LiteLLM Proxy scope.
- **I. Module and Structure**: Changes under `src/infra/outbound` and `src/agents/tools` (and tests). No new extension package unless a channel plugin is later introduced for webchat (not required for this fix).
- **II. CLI and Interface**: No new CLI commands; optional copy tweaks only if user-facing errors are reworded (prefer consistent messaging).
- **III. Test and Evidence**: Regression tests for prior failure (“no configured channels” with webchat context); evidence via failing test before fix when feasible.
- **IV. Code Quality and Typing**: Strict TS; avoid widening `any`; keep selection logic readable; consider extracting a small helper if `resolveMessageChannelSelection` grows.
- **V. PR Truthfulness and Triage**: Scope tied to spec FR-001–FR-005; document relation to `001-gateway-rpc-file-transfer` if both land near each other.

**Post-design re-check**: Design stays within `src/` outbound + tools; contracts document behavior only; no constitution exceptions.

## Project Structure

### Documentation (this feature)

```text
specs/003-webchat-default-priority/
├── plan.md              # This file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/           # Phase 1
│   └── webchat-channel-selection.md
└── tasks.md             # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── infra/outbound/
│   ├── channel-selection.ts      # resolveMessageChannelSelection: webchat fallback when context is webchat
│   ├── channel-selection.test.ts # new cases: zero external channels + webchat tool context
│   ├── message-action-runner.ts # verify ordering: resolveChannel → webchat inline relay (existing)
│   └── channel-resolution.ts     # only if plugin resolution needs a narrow adjustment for typing/bootstrap
├── agents/tools/
│   └── message-tool.ts           # description/schema: default webchat for orchestrator sessions when applicable
└── utils/
    └── message-channel.ts        # reference INTERNAL_MESSAGE_CHANNEL / gateway vs deliverable distinction
```

**Structure Decision**: Core fix in **channel selection** + **tool UX**; no new top-level packages. If `ChannelId` types need to include `webchat` for internal routing, align with existing `INTERNAL_MESSAGE_CHANNEL` usage in `message-action-runner.ts`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| (none)    | —          | —                                    |
