# Contracts: LiteLLM Voice Messages

**Feature**: [spec.md](../spec.md) | **Plan**: [plan.md](../plan.md)

This feature does not add a new public OpenClaw HTTP API. Contracts below define outbound LiteLLM requests and normalized internal payloads used by existing voice/media flows.

## Outbound Contract A: Audio transcription (OpenAI-compatible)

**Endpoint**: `POST {base}/audio/transcriptions`  
**Auth**: `Authorization: Bearer <key>`  
**Body**: multipart form with `file`, `model`, and optional transcription hints.

### Required behavior

- If model is omitted by config/override, request uses default `gpt-4o-audio-preview`.
- On success, response must contain transcription text.
- On non-success HTTP status, map to user-safe failure message and diagnostic reason.

## Outbound Contract B: Audio generation (OpenAI-compatible)

**Endpoint**: `POST {base}/audio/speech`  
**Auth**: `Authorization: Bearer <key>`  
**Body**: JSON containing `model`, `input`, `voice`, and channel-dependent output format.

### Required behavior

- If model is omitted by config/override, request uses default `gpt-4o-audio-preview`.
- Response is binary audio content; runtime converts to a channel-compatible media file/voice note.
- Generation failures must not abort text fallback delivery.

## Inbound Contract A: Transcription result (internal)

Transcription result shape consumed by media-understanding flow:

```json
{
  "text": "recognized speech text",
  "model": "gpt-4o-audio-preview"
}
```

## Inbound Contract B: TTS result (internal)

TTS result shape consumed by outbound message runner:

```json
{
  "success": true,
  "audioPath": "/tmp/tts-xyz/voice-123.opus",
  "provider": "openai",
  "outputFormat": "opus",
  "voiceCompatible": true
}
```

Failure shape:

```json
{
  "success": false,
  "error": "TTS conversion failed: <reason>"
}
```

## Compatibility guarantees

- Existing non-voice and text-only reply behavior remains unchanged.
- Existing media understanding scope/attachment policies remain authoritative.
- No raw API keys or authorization headers are included in logs, diagnostics, or user-visible payloads.
