# Implementation Plan: Fix: toolCall-only NO_REPLY messages cause orchestrator errors

**Branch**: `005-fix-toolcall-no-reply-orchestrator-error` | **Date**: 2026-03-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-fix-toolcall-no-reply-orchestrator-error/spec.md`

## Summary

When an agent uses `message(send, target=webchat, filePath=...)` and the Gateway stores a NO_REPLY assistant message containing only a `toolCall` block (no text, no media), the `chat.history` response includes that message. The orchestrator sees `reply_text=None` and `media_list=[]` and shows "Помощник временно недоступен". The fix modifies `extractAssistantTextForSilentCheck` to detect toolCall-only messages and return `SILENT_REPLY_TOKEN`, so they are dropped by `sanitizeChatHistoryMessages`.

## Technical Context

**Language/Version**: TypeScript (ESM), Node 22+
**Primary Dependencies**: Existing Gateway stack (`src/gateway/server-methods/chat.ts`)
**Storage**: Session transcripts (JSONL) — unchanged
**Testing**: Vitest (`*.test.ts`), colocated at `src/gateway/server-methods/chat.test.ts`
**Target Platform**: Gateway server
**Performance Goals**: No change to hot path; O(n) content array scan per message

## Constitution Check

- **Project Vision (HOBOT)**: Feature fits — fixes a data-integrity bug in the Gateway RPC layer that causes false-positive errors in the orchestrator.
- **I. Module and Structure**: Single-file change in `src/gateway/server-methods/chat.ts`; no new dependencies.
- **II. CLI and Interface**: No CLI surface changes.
- **III. Test and Evidence**: Bug has evidence (issue #2, Bug 2); regression tests added.
- **IV. Code Quality and Typing**: TypeScript strict; no prototype mutation; no `@ts-nocheck`.
- **V. PR Truthfulness and Triage**: Root cause identified in code; fix verified to touch the implicated code path.

## Project Structure

### Source Code (repository root)

```text
src/gateway/server-methods/
├── chat.ts              # Modified: `extractAssistantTextForSilentCheck` + exported functions
└── chat.test.ts        # Extended: new test suite for Bug 2

specs/005-fix-toolcall-no-reply-orchestrator-error/
├── spec.md              # Feature spec
├── plan.md              # This file
├── tasks.md             # Task checklist
└── checklists/
    └── requirements.md  # Quality checklist
```

**Structure Decision**: Single-file change in `src/gateway/server-methods/chat.ts`; no new source files required.

## Implementation Details

### Phase 1: Modify `extractAssistantTextForSilentCheck`

**File**: `src/gateway/server-methods/chat.ts`

**Current behavior** (returns `undefined` for toolCall blocks):

```typescript
function extractAssistantTextForSilentCheck(message: unknown): string | undefined {
  // ... setup code ...
  for (const block of entry.content) {
    if (!block || typeof block !== "object") {
      return undefined;
    }
    const typed = block as { type?: unknown; text?: unknown };
    if (typed.type !== "text" || typeof typed.text !== "string") {
      return undefined; // ← toolCall blocks cause bail-out here
    }
    texts.push(typed.text);
  }
  return texts.length > 0 ? texts.join("\n") : undefined;
}
```

**New behavior** (counts text and toolCall blocks separately):

```typescript
function extractAssistantTextForSilentCheck(message: unknown): string | undefined {
  // ... setup code ...
  let textBlockCount = 0;
  let toolCallBlockCount = 0;
  const texts: string[] = [];

  for (const block of entry.content) {
    if (!block || typeof block !== "object") {
      return undefined;
    }
    const typed = block as { type?: unknown; text?: unknown };
    if (typed.type === "text" && typeof typed.text === "string") {
      textBlockCount++;
      texts.push(typed.text);
    } else if (typed.type === "toolCall") {
      toolCallBlockCount++;
    } else {
      return undefined; // ← other block types still cause bail-out
    }
  }

  if (textBlockCount > 0) {
    return texts.join("\n"); // ← has text, message is kept
  }
  if (toolCallBlockCount > 0 && textBlockCount === 0) {
    return SILENT_REPLY_TOKEN; // ← toolCall-only: dropped as NO_REPLY
  }
  return undefined;
}
```

**Key insight**: The existing `sanitizeChatHistoryMessages` already drops messages where `extractAssistantTextForSilentCheck` returns `SILENT_REPLY_TOKEN`. By returning `SILENT_REPLY_TOKEN` for toolCall-only messages, they are automatically dropped.

### Phase 2: Export functions for testing

**File**: `src/gateway/server-methods/chat.ts`

```typescript
export function extractAssistantTextForSilentCheck(message: unknown): string | undefined { ... }
export function sanitizeChatHistoryMessages(messages: unknown[]): unknown[] { ... }
```

### Phase 3: Add regression tests

**File**: `src/gateway/server-methods/chat.test.ts`

Test cases for `extractAssistantTextForSilentCheck`:

1. Returns `undefined` for non-assistant messages (role !== "assistant")
2. Returns text for mixed text + toolCall content (message is kept)
3. Returns `SILENT_REPLY_TOKEN` for toolCall-only assistant message
4. Returns `undefined` for reasoning-only content (not text, not toolCall)

Test cases for `sanitizeChatHistoryMessages`:

1. ToolCall-only assistant message with no media → dropped
2. ToolCall-only assistant message with media → kept
3. Mixed toolCall + text content → kept
4. Non-assistant messages with toolCall content → kept
5. ToolCall-only with text field that is `NO_REPLY` → dropped
6. ToolCall-only with non-empty text field → kept
7. Multiple consecutive toolCall-only messages → all dropped

## Risk & Verification

- **Risk**: Low. Changes are localized to one function and tests.
- **Verification**: `pnpm test -- src/gateway/server-methods/chat.test.ts` — 25 tests pass (14 existing + 11 new).
- **Regression**: Existing `sanitizeChatHistoryMessages` behavior for text-only NO_REPLY messages and tool-role messages is unchanged.
