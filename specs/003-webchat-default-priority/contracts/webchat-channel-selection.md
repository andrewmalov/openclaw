# Contract: Webchat channel selection and message tool behavior

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)  
**Audience**: Gateway maintainers, orchestrator integrators, agent-runtime authors.

## Purpose

Define **observable** rules for resolving the outbound channel when the agent invokes the `message` tool from an **orchestrator webchat** session, so operators never see spurious “no configured channels” failures for in-session delivery.

## Preconditions

- The agent run is associated with Gateway client context where `currentChannelProvider` (or equivalent) is **`webchat`**.
- Configuration may have **zero** external messaging accounts (Telegram, Discord, Slack, …).

## Invariants

### INV-1: Webchat fallback without external channels

When:

- the tool does not specify a `channel` argument (or it is empty), and
- the session tool context indicates **webchat**, and
- zero external channels are configured,

**Then** channel resolution **must** succeed with **`webchat`** as the resolved channel and **must not** throw `Channel is required (no configured channels detected)`.

### INV-2: Explicit external channel

When the tool specifies a valid `channel` that refers to a **configured and available** external plugin channel,

**Then** resolution **must** use that channel (subject to existing cross-context and policy rules).

### INV-3: Multi-external default

When:

- multiple external channels are configured, and
- `channel` is not specified, and
- session context is **webchat**,

**Then** resolution **must** default to **`webchat`** for generic “reply to this operator” sends (spec P3), unless a future product flag documents a different global default (out of scope unless added to spec).

### INV-4: Error taxonomy

| Condition                        | Must not surface as                           | Should surface as                       |
| -------------------------------- | --------------------------------------------- | --------------------------------------- |
| Legitimate webchat file send     | “Channel required” / “no configured channels” | Success path or inline relay payload    |
| File missing                     | Channel error                                 | Path/validation error                   |
| File over limit                  | Channel error                                 | Size/limit error                        |
| Policy denies cross-context send | Generic channel selection error               | Policy/denied error (existing patterns) |

## Tool-level hints (non-normative for integrators)

The in-repo `message` tool metadata **should** instruct models to use `target=webchat` (and media fields) for attachments intended for the current webchat operator when no other surface is requested.

## Versioning

Contract version follows the feature: **003-webchat-default-priority**. Breaking changes to INV-1–INV-4 require spec amendment.
