# Quickstart: RPC `chat.block` Streaming

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Prerequisites

- Gateway is running and reachable over WebSocket RPC.
- You can connect as an orchestrator client (WebSocket) and call `agent`, `agent.wait`, and `chat.history`.
- Agent block streaming is enabled in configuration.

## 1. Enable block streaming in config

Configure agent defaults to turn streaming on:

```json
{
  "agents": {
    "defaults": {
      "blockStreamingDefault": "on",
      "blockStreamingBreak": "text_end"
    }
  }
}
```

Notes:

- `blockStreamingBreak: "text_end"` sends events as text blocks complete.
- `blockStreamingBreak: "message_end"` sends only the final event (`isFinal: true`).

## 2. Connect orchestrator and start a run

1. Open a WebSocket RPC session to Gateway.
2. Start an agent run using `agent`.
3. In parallel, listen for incoming `event` frames.

When streaming is active, Gateway emits `event: "chat.block"` frames while the run is in progress.

## 3. Handle `chat.block` events

For each `chat.block` event:

- Read `sessionKey` and `runId` to correlate with the current run.
- Render the incoming `block` to end users incrementally.
- Check `isFinal`; when `true`, no more blocks are expected for that run.

Expected payload fields:

- `sessionKey`
- `runId`
- `block`
- `isFinal`

## 4. Complete and fetch final transcript

After `agent.wait` returns success:

1. Call `chat.history` for the session.
2. Use the latest assistant message as final state for text/media.
3. Keep this path as source of truth for persisted transcript state.

## 5. Verify behavior

1. **Real-time**: During a long run, confirm `chat.block` events arrive before `agent.wait` resolves.
2. **Config sensitivity**:
   - with `blockStreamingBreak: "text_end"` -> multiple progressive events,
   - with `blockStreamingBreak: "message_end"` -> only final block.
3. **Backward compatibility**: Ignore all `event` frames in client code and confirm `agent.wait` + `chat.history` still returns complete output.
4. **Disconnect safety**: Disconnect client mid-run and confirm Gateway continues run without sending further events to that client.

## Troubleshooting

| Symptom                           | Check                                                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| No `chat.block` events            | `agents.defaults.blockStreamingDefault` is `"on"` and client listens for `type: "event"` frames |
| Only one event received           | `blockStreamingBreak` may be `"message_end"`                                                    |
| Final result missing after stream | Ensure `agent.wait` succeeded, then call `chat.history`                                         |
| Client sees timeout               | Increase `agent.wait.params.timeoutMs` for long-running tasks                                   |

## References

- `docs/gateway/protocol.md`
- `docs/gateway/orchestrator-rpc-guide.md`
- `docs/gateway/configuration-reference.md`
