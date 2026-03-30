import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_LITELLM_AUDIO_MODEL,
  transcribeLiteLlmAudio,
} from "./media-understanding-provider.js";

describe("litellm media-understanding provider", () => {
  it("uses gpt-4o-audio-preview default model when unset", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ text: "hello world" }),
    }));

    const result = await transcribeLiteLlmAudio({
      buffer: Buffer.from("audio"),
      fileName: "sample.wav",
      apiKey: "litellm-key",
      baseUrl: "https://example.com/v1",
      timeoutMs: 3_000,
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    expect(result.text).toBe("hello world");
    expect(result.model).toBe(DEFAULT_LITELLM_AUDIO_MODEL);
  });
});
