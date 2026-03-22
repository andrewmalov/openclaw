# Quickstart: Verify webchat default channel behavior

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Prerequisites

- Repo dependencies installed (`pnpm install`).
- Node 22+.

## Automated checks

From repository root:

```bash
pnpm test -- src/infra/outbound/channel-selection.test.ts
```

After implementation, also run any new or touched tests, for example:

```bash
pnpm test -- src/infra/outbound/message-action-runner.media.test.ts
pnpm test -- src/infra/outbound/message-action-runner
pnpm test -- src/gateway/server.agent.gateway-server-agent
```

`runMessageAction` / the `message` tool still requires a **target** (or `to`) for `action=send`; use `target: "webchat"` (or `to: "webchat"`) together with `media`, `path`, or `filePath` for orchestrator webchat file relay.

Use the full suite before push:

```bash
pnpm check && pnpm test
```

## Manual scenario (orchestrator integration)

1. Run Gateway + agent in **webchat** mode with **no** external channel credentials configured (or disabled accounts).
2. In webchat, ask the agent to produce a small file (e.g. a log snippet) and **send it in this chat**.
3. **Expect**: No error mentioning “Channel is required” or “no configured channels.”
4. **Expect**: File appears in the webchat UI or in `chat.history` media (depending on **001-gateway-rpc-file-transfer** completion—see [research.md](./research.md) §4).

## Regression anchor

Before the fix, the same scenario produced:

`Channel is required (no configured channels detected).`

After the fix, that string must **not** appear for webchat-only legitimate sends (see spec SC-001, SC-004).
