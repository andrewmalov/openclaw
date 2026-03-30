import { describe, expect, it } from "vitest";
import { normalizeAttachments } from "./attachments.normalize.js";

describe("normalizeAttachments", () => {
  it("falls back to InboundAttachments when MediaPaths and MediaUrls are empty", () => {
    const ctx = {
      InboundAttachments: [
        {
          type: "audio",
          mimeType: "audio/opus",
          fileName: "voice-message.ogg",
          content: "T2dnVu4BAAAA",
        },
      ],
    };
    const result = normalizeAttachments(ctx);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      contentBase64: "T2dnVu4BAAAA",
      fileName: "voice-message.ogg",
      originalType: "audio",
    });
    expect(result[0].mime).toBe("audio/opus");
  });

  it("falls back to InboundAttachments for multiple attachments", () => {
    const ctx = {
      InboundAttachments: [
        { type: "audio", mimeType: "audio/opus", content: "YWJj" },
        { type: "image", mimeType: "image/png", fileName: "photo.png", content: "ZGVm" },
      ],
    };
    const result = normalizeAttachments(ctx);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ contentBase64: "YWJj", originalType: "audio" });
    expect(result[1]).toMatchObject({
      contentBase64: "ZGVm",
      originalType: "image",
      fileName: "photo.png",
    });
  });

  it("prefers MediaPaths over InboundAttachments", () => {
    const ctx = {
      MediaPaths: ["/tmp/voice.ogg"],
      MediaTypes: ["audio/opus"],
      InboundAttachments: [{ type: "audio", content: "T2dnVu4BAAAA" }],
    };
    const result = normalizeAttachments(ctx);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe("/tmp/voice.ogg");
    expect(result[0].contentBase64).toBeUndefined();
  });

  it("returns empty array when no attachments present", () => {
    const ctx = {};
    expect(normalizeAttachments(ctx)).toHaveLength(0);
  });
});
