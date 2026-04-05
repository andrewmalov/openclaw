import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../../config/config.js";
import { isRpcAudioMime, shouldTranscribeInboundAudio } from "./inbound-attachments.js";

describe("shouldTranscribeInboundAudio", () => {
  it("returns false when config is missing", () => {
    expect(shouldTranscribeInboundAudio(undefined)).toBe(false);
  });

  it("returns true when tools.media.audio is missing (defaults to on)", () => {
    expect(shouldTranscribeInboundAudio({} as OpenClawConfig)).toBe(true);
  });

  it("returns false when tools.media.audio.enabled is false", () => {
    expect(
      shouldTranscribeInboundAudio({
        tools: { media: { audio: { enabled: false } } },
      } as OpenClawConfig),
    ).toBe(false);
  });

  it("returns true when tools.media.audio.enabled is true", () => {
    expect(
      shouldTranscribeInboundAudio({
        tools: { media: { audio: { enabled: true } } },
      } as OpenClawConfig),
    ).toBe(true);
  });
});

describe("isRpcAudioMime", () => {
  it("detects common voice MIME types", () => {
    expect(isRpcAudioMime("audio/ogg")).toBe(true);
    expect(isRpcAudioMime("audio/oga")).toBe(true);
    expect(isRpcAudioMime("audio/opus")).toBe(true);
    expect(isRpcAudioMime("application/pdf")).toBe(false);
  });

  it("treats empty as non-audio", () => {
    expect(isRpcAudioMime(undefined)).toBe(false);
    expect(isRpcAudioMime("")).toBe(false);
  });
});
