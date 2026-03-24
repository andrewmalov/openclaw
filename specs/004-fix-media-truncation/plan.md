# Implementation Plan: Fix: chat.history media field lost when history truncated

**Branch**: `004-fix-media-truncation` | **Date**: 2026-03-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-fix-media-truncation/spec.md`

## Summary

When `message(send, target=webchat, filePath=...)` is used, the Gateway stores the file path in `SessionRunMedia` and injects it into the last assistant message's `media[]` field before `chat.history` returns. However, if the session history is large enough to trigger `enforceChatHistoryFinalBudget`, the last assistant message is replaced with a bare placeholder that drops the `media` field entirely. The fix ensures that when `enforceChatHistoryFinalBudget` creates a placeholder for the last message, it preserves the `media` array (with content omitted if it exceeds the per-attachment byte limit).

## Technical Context

**Language/Version**: TypeScript (ESM), Node 22+
**Primary Dependencies**: Existing Gateway stack (`src/gateway/server-methods/chat.ts`)
**Storage**: Session transcripts (JSONL) — unchanged
**Testing**: Vitest (`*.test.ts`), colocated at `src/gateway/server-methods/chat.test.ts`
**Target Platform**: Gateway server
**Performance Goals**: No change to hot path; truncation is already O(messages)
**Constraints**: `injectMessageToolMediaIntoLastAssistantMessage` must run before `enforceChatHistoryFinalBudget`

## Constitution Check

- **Project Vision (HOBOT)**: Feature fits — fixes a data-integrity bug in the Gateway RPC layer that breaks orchestrator file delivery.
- **I. Module and Structure**: Single-file change in `src/gateway/server-methods/chat.ts`; no new dependencies.
- **II. CLI and Interface**: No CLI surface changes.
- **III. Test and Evidence**: Bug has evidence (issue #1); regression test will be added.
- **IV. Code Quality and Typing**: TypeScript strict; no prototype mutation; no `@ts-nocheck`.
- **V. PR Truthfulness and Triage**: Root cause identified in code; fix verified to touch the implicated code path.

## Project Structure

### Source Code (repository root)

```text
src/gateway/server-methods/
├── chat.ts              # Modified: `enforceChatHistoryFinalBudget` + `buildOversizedHistoryPlaceholder`
└── chat.test.ts        # New tests: truncation with pending media

specs/004-fix-media-truncation/
├── spec.md              # Feature spec
├── plan.md              # This file
└── checklists/
    └── requirements.md  # Quality checklist
```

**Structure Decision**: Single-file change in `src/gateway/server-methods/chat.ts`; no new source files required.

## Implementation Details

### Phase 1: Modify `buildOversizedHistoryPlaceholder`

**File**: `src/gateway/server-methods/chat.ts`

Currently:

```typescript
function buildOversizedHistoryPlaceholder(message?: unknown): Record<string, unknown> {
  const role =
    message &&
    typeof message === "object" &&
    typeof (message as { role?: unknown }).role === "string"
      ? (message as { role: string }).role
      : "assistant";
  const timestamp =
    message &&
    typeof message === "object" &&
    typeof (message as { timestamp?: unknown }).timestamp === "number"
      ? (message as { timestamp: number }).timestamp
      : Date.now();
  return {
    role,
    timestamp,
    content: [{ type: "text", text: CHAT_HISTORY_OVERSIZED_PLACEHOLDER }],
    __openclaw: { truncated: true, reason: "oversized" },
  };
}
```

**Change**: Extract and carry forward `media[]` from the original message. When `content` would be included in the base64 estimate, `content` is dropped but `mimeType`, `fileName`, and `type` are preserved.

The `outgoingMaxBytes` parameter must be threaded through from the call site. Since `enforceChatHistoryFinalBudget` is called from `chat.history` handler (which has `cfg.gateway?.rpcAttachments`), `outgoingMaxBytes` is available at the call site and must be passed as a parameter.

### Phase 2: Modify `enforceChatHistoryFinalBudget`

**File**: `src/gateway/server-methods/chat.ts`

Currently:

```typescript
function enforceChatHistoryFinalBudget(params: { messages: unknown[]; maxBytes: number }): {
  messages: unknown[];
  placeholderCount: number;
} {
  const { messages, maxBytes } = params;
  if (messages.length === 0) {
    return { messages, placeholderCount: 0 };
  }
  if (jsonUtf8Bytes(messages) <= maxBytes) {
    return { messages, placeholderCount: 0 };
  }
  const last = messages.at(-1);
  if (last && jsonUtf8Bytes([last]) <= maxBytes) {
    return { messages: [last], placeholderCount: 0 };
  }
  const placeholder = buildOversizedHistoryPlaceholder(last);
  if (jsonUtf8Bytes([placeholder]) <= maxBytes) {
    return { messages: [placeholder], placeholderCount: 1 };
  }
  return { messages: [], placeholderCount: 0 };
}
```

**Changes**:

1. Accept new `outgoingMaxBytes: number` parameter.
2. Pass it to `buildOversizedHistoryPlaceholder`.
3. Update the call site in `chat.history` handler to pass `cfg.gateway?.rpcAttachments?.outgoingPerAttachmentMaxBytes ?? GATEWAY_RPC_ATTACHMENT_DEFAULT_MAX_BYTES`.

### Phase 3: Add regression tests

**File**: `src/gateway/server-methods/chat.test.ts` (create if not exists; otherwise extend existing)

Test cases:

1. `enforceChatHistoryFinalBudget`: last message with `media[]` survives (no truncation needed).
2. `enforceChatHistoryFinalBudget`: last message with `media[]` is replaced by placeholder that still has `media[]`.
3. `enforceChatHistoryFinalBudget`: last message with oversized `media[].content` — placeholder has `media[]` without `content`.
4. `buildOversizedHistoryPlaceholder`: message without `media` returns placeholder without `media`.
5. `buildOversizedHistoryPlaceholder`: message with `media` (some oversized) returns placeholder with trimmed media.

## Pipeline Order (no change needed)

```
readSessionMessages
  → enrichAssistantMessagesWithTextAndMedia      # adds text + media from content blocks
  → injectMessageToolMediaIntoLastAssistantMessage # adds pending inlineRelay files to last msg's media[]
  → sanitizeChatHistoryMessages                  # strips usage/cost, drops silent-reply tokens (keeps media)
  → replaceOversizedChatHistoryMessages          # replaces individual oversized messages with placeholder
  → capArrayByJsonBytes                          # drops oldest messages until under budget
  → enforceChatHistoryFinalBudget                # LAST: keeps last message (or placeholder) under budget
```

Step 2 runs **before** step 6, so media is already attached when `enforceChatHistoryFinalBudget` creates a placeholder. This is already correct.

## Risk & Verification

- **Risk**: Low. Changes are localized to two functions.
- **Verification**: `pnpm test -- src/gateway/server-methods/chat.test.ts` — run tests after implementation.
- **Regression**: Existing `chat.history` tests continue to pass (verify no behavioral change for non-media cases).
