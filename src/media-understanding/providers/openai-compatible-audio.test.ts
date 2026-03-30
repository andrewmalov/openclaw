import { describe, expect, it } from "vitest";
import {
  createRequestCaptureJsonFetch,
  installPinnedHostnameTestHooks,
} from "./audio.test-helpers.js";
import { transcribeOpenAiCompatibleAudio } from "./openai-compatible-audio.js";

installPinnedHostnameTestHooks();

describe("transcribeOpenAiCompatibleAudio", () => {
  it("uses defaultModel when model is blank", async () => {
    const { fetchFn, getRequest } = createRequestCaptureJsonFetch({ text: "hi" });

    const result = await transcribeOpenAiCompatibleAudio({
      buffer: Buffer.from("x"),
      fileName: "a.wav",
      apiKey: "k",
      timeoutMs: 1000,
      baseUrl: "https://example.com/v1",
      model: "   ",
      defaultBaseUrl: "https://example.com/v1",
      defaultModel: "gpt-4o-audio-preview",
      fetchFn,
    });

    expect(result.text).toBe("hi");
    expect(result.model).toBe("gpt-4o-audio-preview");
    const { init } = getRequest();
    const form = init?.body as FormData;
    expect(form?.get("model")).toBe("gpt-4o-audio-preview");
  });

  it("maps HTTP errors to a user-safe message", async () => {
    const fetchFn = async () =>
      new Response("bad", { status: 415, statusText: "Unsupported Media Type" });

    await expect(
      transcribeOpenAiCompatibleAudio({
        buffer: Buffer.from("x"),
        fileName: "a.wav",
        apiKey: "k",
        timeoutMs: 1000,
        baseUrl: "https://example.com/v1",
        defaultBaseUrl: "https://example.com/v1",
        defaultModel: "gpt-4o-audio-preview",
        fetchFn: fetchFn as typeof fetch,
      }),
    ).rejects.toThrow(/could not process this audio/i);
  });
});
