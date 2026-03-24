# Specification Quality Checklist: Fix: chat.history media field lost when history truncated

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-03-24
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) — spec describes behavior, not how to implement it
- [x] Focused on user value and business needs — data integrity, orchestrator can deliver files
- [x] Written for non-technical stakeholders — user stories use plain language
- [x] All mandatory sections completed — User Scenarios, Requirements, Success Criteria all filled

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous — FRs describe exact conditions and expected outputs
- [x] Success criteria are measurable — SCs describe observable outcomes (media_count > 0, placeholder carries media)
- [x] Success criteria are technology-agnostic (no implementation details) — no mention of TypeScript, functions, etc.
- [x] All acceptance scenarios are defined — 3 scenarios covering no-truncation, truncation-with-media, oversized-placeholder
- [x] Edge cases are identified — silent-reply token, file-read failure, repeated calls
- [x] Scope is clearly bounded — fix is scoped to `enforceChatHistoryFinalBudget` and `injectMessageToolMediaIntoLastAssistantMessage` interaction
- [x] Dependencies and assumptions identified — "injectMessageToolMediaIntoLastAssistantMessage runs before enforceChatHistoryFinalBudget"

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria — each FR maps to an acceptance scenario
- [x] User scenarios cover primary flows — truncation-with-media, truncation-without-media, oversized-placeholder
- [x] Feature meets measurable outcomes defined in Success Criteria — SCs directly validate the bug fix
- [x] No implementation details leak into specification

## Notes

- The spec correctly identifies the root cause: `enforceChatHistoryFinalBudget` replaces the last message with a bare placeholder that does not carry forward the `media` field from the original message.
- The fix requires two changes: (1) `enforceChatHistoryFinalBudget` must extract and preserve `media` when creating a placeholder, and (2) `injectMessageToolMediaIntoLastAssistantMessage` must run before `enforceChatHistoryFinalBudget` in the `chat.history` handler pipeline.
