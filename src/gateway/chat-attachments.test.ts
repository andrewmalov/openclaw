import { describe, expect, it, vi } from "vitest";
import {
  AttachmentValidationError,
  buildMessageWithAttachments,
  type ChatAttachment,
  parseMessageWithAttachments,
} from "./chat-attachments.js";

const PNG_1x1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/woAAn8B9FD5fHAAAAAASUVORK5CYII=";

async function parseWithWarnings(message: string, attachments: ChatAttachment[]) {
  const logs: string[] = [];
  const parsed = await parseMessageWithAttachments(message, attachments, {
    log: { warn: (warning) => logs.push(warning) },
  });
  return { parsed, logs };
}

describe("buildMessageWithAttachments", () => {
  it("embeds a single image as data URL", () => {
    const msg = buildMessageWithAttachments("see this", [
      {
        type: "image",
        mimeType: "image/png",
        fileName: "dot.png",
        content: PNG_1x1,
      },
    ]);
    expect(msg).toContain("see this");
    expect(msg).toContain(`data:image/png;base64,${PNG_1x1}`);
    expect(msg).toContain("![dot.png]");
  });

  it("rejects non-image mime types", () => {
    const bad: ChatAttachment = {
      type: "file",
      mimeType: "application/pdf",
      fileName: "a.pdf",
      content: "AAA",
    };
    expect(() => buildMessageWithAttachments("x", [bad])).toThrow(/image/);
  });
});

describe("parseMessageWithAttachments", () => {
  it("strips data URL prefix", async () => {
    const parsed = await parseMessageWithAttachments(
      "see this",
      [
        {
          type: "image",
          mimeType: "image/png",
          fileName: "dot.png",
          content: `data:image/png;base64,${PNG_1x1}`,
        },
      ],
      { log: { warn: () => {} } },
    );
    expect(parsed.images).toHaveLength(1);
    expect(parsed.images[0]?.mimeType).toBe("image/png");
    expect(parsed.images[0]?.data).toBe(PNG_1x1);
    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.attachments[0]).toEqual({
      type: "image",
      mimeType: "image/png",
      fileName: "dot.png",
      content: PNG_1x1,
    });
  });

  it("sniffs mime when missing", async () => {
    const { parsed, logs } = await parseWithWarnings("see this", [
      {
        type: "image",
        fileName: "dot.png",
        content: PNG_1x1,
      },
    ]);
    expect(parsed.message).toBe("see this");
    expect(parsed.images).toHaveLength(1);
    expect(parsed.images[0]?.mimeType).toBe("image/png");
    expect(parsed.images[0]?.data).toBe(PNG_1x1);
    expect(parsed.attachments).toHaveLength(1);
    expect(logs).toHaveLength(0);
  });

  it("includes non-image in unified attachments (not dropped)", async () => {
    const pdf = Buffer.from("%PDF-1.4\n").toString("base64");
    const { parsed } = await parseWithWarnings("x", [
      {
        type: "file",
        mimeType: "application/pdf",
        fileName: "doc.pdf",
        content: pdf,
      },
    ]);
    expect(parsed.images).toHaveLength(0);
    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.attachments[0]).toMatchObject({
      type: "file",
      mimeType: "application/pdf",
      fileName: "doc.pdf",
      content: pdf,
    });
  });

  it("prefers sniffed mime type and logs mismatch", async () => {
    const { parsed, logs } = await parseWithWarnings("x", [
      {
        type: "image",
        mimeType: "image/jpeg",
        fileName: "dot.png",
        content: PNG_1x1,
      },
    ]);
    expect(parsed.images).toHaveLength(1);
    expect(parsed.images[0]?.mimeType).toBe("image/png");
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatch(/mime mismatch/i);
  });

  it("includes unknown mime in attachments as file", async () => {
    const unknown = Buffer.from("not an image").toString("base64");
    const { parsed } = await parseWithWarnings("x", [
      { type: "file", fileName: "unknown.bin", content: unknown },
    ]);
    expect(parsed.images).toHaveLength(0);
    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.attachments[0]?.type).toBe("file");
  });

  it("returns both image and non-image in unified attachments", async () => {
    const pdf = Buffer.from("%PDF-1.4\n").toString("base64");
    const { parsed } = await parseWithWarnings("x", [
      {
        type: "image",
        mimeType: "image/png",
        fileName: "dot.png",
        content: PNG_1x1,
      },
      {
        type: "file",
        mimeType: "application/pdf",
        fileName: "not-image.pdf",
        content: pdf,
      },
    ]);
    expect(parsed.images).toHaveLength(1);
    expect(parsed.images[0]?.mimeType).toBe("image/png");
    expect(parsed.images[0]?.data).toBe(PNG_1x1);
    expect(parsed.attachments).toHaveLength(2);
    expect(parsed.attachments[0]).toMatchObject({ type: "image", mimeType: "image/png" });
    expect(parsed.attachments[1]).toMatchObject({ type: "file", mimeType: "application/pdf" });
  });
});

describe("shared attachment validation", () => {
  it("rejects invalid base64 content for both builder and parser", async () => {
    const bad: ChatAttachment = {
      type: "image",
      mimeType: "image/png",
      fileName: "dot.png",
      content: "%not-base64%",
    };

    expect(() => buildMessageWithAttachments("x", [bad])).toThrow(/base64/i);
    await expect(
      parseMessageWithAttachments("x", [bad], { log: { warn: () => {} } }),
    ).rejects.toThrow(/base64/i);
  });

  it("rejects images over limit for both builder and parser without decoding base64", async () => {
    const big = "A".repeat(10_000);
    const att: ChatAttachment = {
      type: "image",
      mimeType: "image/png",
      fileName: "big.png",
      content: big,
    };

    const fromSpy = vi.spyOn(Buffer, "from");
    try {
      expect(() => buildMessageWithAttachments("x", [att], { maxBytes: 16 })).toThrow(
        /exceeds size limit/i,
      );
      await expect(
        parseMessageWithAttachments("x", [att], { maxBytes: 16, log: { warn: () => {} } }),
      ).rejects.toThrow(/exceeds size limit/i);
      const base64Calls = fromSpy.mock.calls.filter((args) => (args as unknown[])[1] === "base64");
      expect(base64Calls).toHaveLength(0);
    } finally {
      fromSpy.mockRestore();
    }
  });

  it("uses configurable maxBytes (default 100 MB)", async () => {
    const small = "AAAA"; // valid base64, tiny decoded size
    const att: ChatAttachment = {
      type: "image",
      mimeType: "image/png",
      fileName: "tiny.png",
      content: small,
    };
    const err = await parseMessageWithAttachments("x", [att], {
      maxBytes: 1,
      log: { warn: () => {} },
    })
      .then(() => null)
      .catch((e) => e as AttachmentValidationError);
    expect(err).toBeInstanceOf(AttachmentValidationError);
    expect(err?.reason).toBe("size_exceeded");

    const parsed = await parseMessageWithAttachments("x", [att], {
      maxBytes: 10,
      log: { warn: () => {} },
    });
    expect(parsed.attachments).toHaveLength(1);
  });

  it("validation errors include reason (size_exceeded, invalid_base64, type_not_allowed)", async () => {
    const invalidB64: ChatAttachment = {
      type: "file",
      mimeType: "application/pdf",
      fileName: "x.pdf",
      content: "not!!!valid!!!base64!!!",
    };
    let err: unknown;
    err = await parseMessageWithAttachments("x", [invalidB64], { log: { warn: () => {} } })
      .then(() => null)
      .catch((e) => e);
    expect(err).toBeInstanceOf(AttachmentValidationError);
    expect((err as AttachmentValidationError).reason).toBe("invalid_base64");

    const pdf = Buffer.from("%PDF-1.4\n").toString("base64");
    err = await parseMessageWithAttachments(
      "x",
      [{ type: "file", mimeType: "application/pdf", content: pdf }],
      {
        mimeBlocklist: ["application/pdf"],
        log: { warn: () => {} },
      },
    )
      .then(() => null)
      .catch((e) => e);
    expect(err).toBeInstanceOf(AttachmentValidationError);
    expect((err as AttachmentValidationError).reason).toBe("type_not_allowed");

    err = await parseMessageWithAttachments(
      "x",
      [{ type: "file", mimeType: "application/zip", content: "AAAA" }],
      {
        mimeAllowlist: ["image/*"],
        log: { warn: () => {} },
      },
    )
      .then(() => null)
      .catch((e) => e);
    expect(err).toBeInstanceOf(AttachmentValidationError);
    expect((err as AttachmentValidationError).reason).toBe("type_not_allowed");
  });
});
