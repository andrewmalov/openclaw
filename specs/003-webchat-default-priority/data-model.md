# Data Model: Webchat default channel for orchestrator agent

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This feature does **not** introduce new databases or persistent entities. Below is the **logical model** for requirements traceability.

## Entities

### Orchestrator webchat session

| Field                                | Description                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| `sessionKey`                         | Stable agent/session identifier (existing OpenClaw session key semantics).      |
| `originSurface`                      | Implicitly `webchat` when connected via Gateway webchat client mode.            |
| `toolContext.currentChannelProvider` | Runtime hint set to `webchat` for message tool construction (existing pattern). |

**Relationships**: One session has many turns; each turn may invoke tools including `message`.

**Validation**: Delivery must not target another operator’s session; existing session isolation rules apply.

---

### Channel resolution result

| Field        | Description                                                                                                                              |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `channel`    | Resolved target surface: `webchat` or a plugin channel id (`telegram`, `discord`, …).                                                    |
| `configured` | List of externally configured plugin channels (for diagnostics/logging; may be empty).                                                   |
| `source`     | How resolution happened: `explicit`, `tool-context-fallback`, `single-configured`, or extended value for webchat fallback if introduced. |

**State transitions**: N/A (derived per tool invocation).

**Rules**:

- When `source` is webchat fallback, **must not** require `configured.length > 0`.
- When multiple external channels exist and user gave no explicit channel, **policy** defaults webchat for webchat-originated context (see [research.md](./research.md) §3).

---

### Outbound delivery action (message tool)

| Field                         | Description                                                       |
| ----------------------------- | ----------------------------------------------------------------- |
| `action`                      | e.g. `send`, `broadcast`, channel-specific actions.               |
| `channel`                     | After normalization, the resolved channel id.                     |
| `target` / `to`               | Address within channel (e.g. `webchat` for inline relay).         |
| `media` / `path` / `filePath` | Local or sandbox-relative path for attachments (existing params). |

**Validation**:

- File missing → clear file error (spec edge cases), not channel error.
- Oversized file → limit error (spec edge cases), not channel error.

---

## Diagram (conceptual)

```text
Operator (webchat UI) ──► Gateway ──► Agent run ──► message tool
                                                      │
                                                      ▼
                                            Channel resolution
                                            (webchat fallback OK)
                                                      │
                                                      ▼
                                            runMessageAction
                                            (inline relay if media)
```
