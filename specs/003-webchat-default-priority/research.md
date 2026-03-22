# Research: Webchat default channel for orchestrator agent

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## 1. Root cause of “Channel is required (no configured channels detected)” in webchat

**Decision**: The error is thrown from `resolveMessageChannelSelection` when there is no explicit `channel` param, the **fallback** from `toolContext.currentChannelProvider` does not resolve (because `resolveKnownChannel` requires `isDeliverableMessageChannel`, and **`webchat` is not deliverable**—it is internal/gateway-only), and `listConfiguredMessageChannels` returns an empty array.

**Rationale**: Code review (2026-03-22) confirmed: `webchat` is in `listGatewayMessageChannels` but not `listDeliverableMessageChannels`; selection logic only understands plugin-backed outbound channels. Orchestrator webchat sessions therefore never contribute a valid fallback channel.

**Alternatives considered**: (1) Register a full channel plugin for webchat — heavier than needed; existing `message-action-runner` already special-cases webchat inline relay after channel resolution. (2) Require operators to configure a dummy external channel — violates spec FR-002/FR-003.

---

## 2. Where to fix (single responsibility)

**Decision**: Implement webchat as a **selection-time** fallback: when `fallbackChannel` normalizes to `INTERNAL_MESSAGE_CHANNEL` (`webchat`), return `{ channel: webchat, source: "tool-context-fallback" }` (or equivalent) **without** requiring `resolveOutboundChannelPlugin(webchat)`. Downstream `runMessageAction` already contains webchat-specific behavior (inline relay for media, text-only guard).

**Rationale**: Minimal surface area; avoids duplicating send logic; fixes the ordering bug (selection ran before relay logic).

**Alternatives considered**: (1) Skip channel selection entirely in `message-tool.ts` for webchat — splits logic across layers and risks drift. (2) Only document “always pass channel=webchat” in prompts — fragile; models still omit parameters.

---

## 3. Multi-channel and explicit intent (spec FR-004)

**Decision**: If the operator **explicitly** passes `channel` to a configured external plugin, honor it. If **multiple** external channels are configured and there is **no** explicit channel, keep the existing “channel required when multiple configured” error **unless** tool context is webchat **and** spec priority says default stays webchat for unspecified sends—default to **webchat** for orchestrator-originated sessions when `channel` is omitted, even if Telegram/Discord also exist.

**Rationale**: Matches spec P3 acceptance: generic “send here” from webchat should default to webchat; explicit external channel name in tool args or clear model-specified `channel` still routes externally.

**Alternatives considered**: (1) Always force explicit `channel` when >1 external — reintroduces operator friction for HOBOT default flow. (2) Prefer “last used” external channel — ambiguous and works against orchestrator-as-default.

---

## 4. Relation to gateway RPC file transfer (001)

**Decision**: Feature **003** unblocks the agent path to **reach** webchat inline relay in `message-action-runner`. Feature **001** (if implemented) ensures **media** from that path appears in `chat.history` / RPC responses. Teams should land or verify **003** before claiming end-to-end “file in webchat history” if 001 is not yet complete.

**Rationale**: Separate concerns: selection vs. transcript enrichment.

**Alternatives considered**: Merge into one mega-change — higher review burden and blurrier rollback.

---

## 5. Agent tool description and schema

**Decision**: Update `message` tool **description** (and if needed, schema hints) so that in webchat/orchestrator contexts the model is steered toward `action=send`, `target=webchat` (or equivalent), and media fields for files—without removing other channels from the schema when configured.

**Rationale**: Reduces bad tool calls; complements code-side default.

**Alternatives considered**: Prompt-only changes in orchestrator — easier to drift from repo; tool metadata is versioned with the gateway.
