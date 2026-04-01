# Quickstart: LiteLLM Voice Messages

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Goal

Validate that voice input transcription and voice reply generation work through LiteLLM, with default model `gpt-4o-mini-transcribe`.

## Prerequisites

- LiteLLM endpoint reachable from the OpenClaw runtime.
- Runtime has a valid LiteLLM API key and base URL.
- A channel that supports inbound audio and outbound media replies.

## 1) Configure runtime for LiteLLM voice path

- Ensure LiteLLM credentials/base URL are available to the running process (`LITELLM_API_KEY`, `LITELLM_API_BASE` pointing at the proxy `/v1` root).
- Optionally set `tools.media.audio.models` (or `messages.tts.openai`) to override defaults; leave models unset to verify **`gpt-4o-mini-transcribe`** fallback for transcription and **`gpt-4o-audio-preview`** for TTS when the OpenAI-compatible base matches LiteLLM.

## 2) Validate inbound transcription default

1. Send a short voice message in a supported channel.
2. Confirm transcript-driven assistant response appears.
3. Verify diagnostics/model resolution show `gpt-4o-mini-transcribe` when no model override is configured.

## 3) Validate outbound voice generation default

1. Trigger a reply path that generates audio output.
2. Confirm returned message contains playable audio (voice note where supported).
3. Verify synthesis used `gpt-4o-audio-preview` when no override is configured.

## 4) Validate override behavior

1. Set explicit model override for transcription and generation.
2. Repeat inbound + outbound tests.
3. Confirm configured override is used instead of default.

## 5) Validate failure handling

1. Temporarily misconfigure key/base/model.
2. Confirm user receives clear failure messaging.
3. Confirm non-voice text flow still completes and turn is not dropped.

## Verification checklist

- Voice recognition works through LiteLLM.
- Voice generation works through LiteLLM.
- Default STT model is `gpt-4o-mini-transcribe` when unspecified.
- Explicit model overrides take precedence.
- Failures are explicit and safe, with text fallback preserved.
