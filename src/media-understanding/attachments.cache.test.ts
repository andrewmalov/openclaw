import { describe, expect, it } from "vitest";
import { MediaAttachmentCache } from "./attachments.js";

describe("MediaAttachmentCache contentBase64", () => {
  it("resolves buffer from contentBase64 without hitting the filesystem", async () => {
    const cache = new MediaAttachmentCache([
      {
        index: 0,
        mime: "audio/opus",
        contentBase64: "T2dnVu4BAAAAAABhdmNhc3RpYy5vcHMAAAAAAAAAAAAA",
      },
    ]);

    const result = await cache.getBuffer({
      attachmentIndex: 0,
      maxBytes: 1024,
      timeoutMs: 5000,
    });

    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.length).toBeGreaterThan(0);
    expect(result.mime).toBe("audio/opus");
  });

  it("respects maxBytes when reading contentBase64", async () => {
    const cache = new MediaAttachmentCache([
      {
        index: 0,
        contentBase64: "T2dnVu4BAAAAAABhdmNhc3RpYy5vcHMAAAAAAAAAAAAA",
      },
    ]);

    await expect(
      cache.getBuffer({ attachmentIndex: 0, maxBytes: 1, timeoutMs: 5000 }),
    ).rejects.toThrow(/maxBytes/);
  });

  it("returns a temp path for contentBase64 via getPath", async () => {
    const cache = new MediaAttachmentCache([
      {
        index: 0,
        mime: "audio/ogg",
        fileName: "voice-message.ogg",
        contentBase64: "T2dnVu4BAAAAAABhdmNhc3RpYy5vcHMAAAAAAAAAAAAA",
      },
    ]);

    const pathResult = await cache.getPath({
      attachmentIndex: 0,
      timeoutMs: 5000,
    });

    expect(pathResult.path).toMatch(/\.ogg$/);
    await pathResult.cleanup?.();
  });
});
