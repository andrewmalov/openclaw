import { describe, expect, it } from "vitest";
import { jsonUtf8Bytes } from "../../infra/json-utf8-bytes.js";
import { estimateBase64DecodedBytes } from "../../media/base64.js";
import { sanitizeChatHistoryMessages } from "./chat.js";
import { extractAssistantTextForSilentCheck } from "./chat.js";

const CHAT_HISTORY_OVERSIZED_PLACEHOLDER = "[chat.history omitted: message too large]";

type ChatHistoryMediaItem = {
  type: "image" | "file";
  mimeType?: string;
  fileName?: string;
  content?: string;
};

function buildOversizedHistoryPlaceholder(
  message: unknown,
  outgoingMaxBytes: number,
): Record<string, unknown> {
  const role =
    message &&
    typeof message === "object" &&
    typeof (message as { role?: unknown }).role === "string"
      ? (message as { role: string }).role
      : "assistant";
  const timestamp =
    message &&
    typeof message === "object" &&
    typeof (message as { timestamp?: unknown }).timestamp === "number"
      ? (message as { timestamp: number }).timestamp
      : Date.now();

  const placeholder: Record<string, unknown> = {
    role,
    timestamp,
    content: [{ type: "text", text: CHAT_HISTORY_OVERSIZED_PLACEHOLDER }],
    __openclaw: { truncated: true, reason: "oversized" },
  };

  if (message && typeof message === "object") {
    const entry = message as Record<string, unknown>;
    if (Array.isArray(entry.media)) {
      const media: ChatHistoryMediaItem[] = [];
      for (const item of entry.media) {
        if (!item || typeof item !== "object") {
          continue;
        }
        const m = item as Record<string, unknown>;
        const type = typeof m.type === "string" ? m.type : undefined;
        const mimeType = typeof m.mimeType === "string" ? m.mimeType : undefined;
        const fileName = typeof m.fileName === "string" ? m.fileName : undefined;
        const content = typeof m.content === "string" ? m.content : undefined;
        if (!type) {
          continue;
        }
        const outItem: ChatHistoryMediaItem = { type: type as "image" | "file" };
        if (mimeType) {
          outItem.mimeType = mimeType;
        }
        if (fileName) {
          outItem.fileName = fileName;
        }
        if (content && estimateBase64DecodedBytes(content) <= outgoingMaxBytes) {
          outItem.content = content;
        }
        media.push(outItem);
      }
      if (media.length > 0) {
        placeholder.media = media;
      }
    }
  }

  return placeholder;
}

function enforceChatHistoryFinalBudget(params: {
  messages: unknown[];
  maxBytes: number;
  outgoingMaxBytes: number;
}): {
  messages: unknown[];
  placeholderCount: number;
} {
  const { messages, maxBytes, outgoingMaxBytes } = params;
  if (messages.length === 0) {
    return { messages, placeholderCount: 0 };
  }
  if (jsonUtf8Bytes(messages) <= maxBytes) {
    return { messages, placeholderCount: 0 };
  }
  const last = messages.at(-1);
  if (last && jsonUtf8Bytes([last]) <= maxBytes) {
    return { messages: [last], placeholderCount: 0 };
  }
  const placeholder = buildOversizedHistoryPlaceholder(last, outgoingMaxBytes);
  if (jsonUtf8Bytes([placeholder]) <= maxBytes) {
    return { messages: [placeholder], placeholderCount: 1 };
  }
  return { messages: [], placeholderCount: 0 };
}

function makeMediaItem(
  overrides: Partial<ChatHistoryMediaItem> & { type: "image" | "file" },
): ChatHistoryMediaItem {
  return {
    type: overrides.type,
    mimeType: overrides.mimeType,
    fileName: overrides.fileName,
    content: overrides.content,
  };
}

describe("buildOversizedHistoryPlaceholder", () => {
  it("returns placeholder without media when message has no media", () => {
    const msg = { role: "assistant", content: "hello" };
    const result = buildOversizedHistoryPlaceholder(msg, 100_000_000);
    expect(result).toHaveProperty("role", "assistant");
    expect(result).toHaveProperty("timestamp");
    expect(result).toHaveProperty("content");
    expect(result).not.toHaveProperty("media");
  });

  it("returns placeholder with media when message has sized content", () => {
    const mediaItem = makeMediaItem({
      type: "file",
      mimeType: "application/pdf",
      fileName: "report.pdf",
      content: "JVBERi",
    });
    const msg = { role: "assistant", media: [mediaItem] };
    const result = buildOversizedHistoryPlaceholder(msg, 100_000_000);
    expect(result).toHaveProperty("media");
    const media = result.media as ChatHistoryMediaItem[];
    expect(media).toHaveLength(1);
    expect(media[0]).toMatchObject({
      type: "file",
      mimeType: "application/pdf",
      fileName: "report.pdf",
      content: "JVBERi",
    });
  });

  it("omits content when it exceeds outgoingMaxBytes but preserves mimeType/fileName/type", () => {
    const largeContent = btoa("this is a somewhat long string");
    const mediaItem = makeMediaItem({
      type: "image",
      mimeType: "image/png",
      fileName: "photo.png",
      content: largeContent,
    });
    const msg = { role: "user", media: [mediaItem] };
    const smallLimit = 5;
    const result = buildOversizedHistoryPlaceholder(msg, smallLimit);
    expect(result).toHaveProperty("media");
    const media = result.media as ChatHistoryMediaItem[];
    expect(media).toHaveLength(1);
    expect(media[0]).toMatchObject({
      type: "image",
      mimeType: "image/png",
      fileName: "photo.png",
    });
    expect(media[0]).not.toHaveProperty("content");
  });

  it("handles message with multiple media items, some oversized", () => {
    const smallContent = btoa("hi");
    const largeContent = btoa("this is a long string");
    const media = [
      makeMediaItem({ type: "file", content: smallContent, fileName: "small.txt" }),
      makeMediaItem({ type: "image", content: largeContent, fileName: "large.png" }),
    ];
    const msg = { role: "assistant", media };
    const result = buildOversizedHistoryPlaceholder(msg, 5);
    const outMedia = result.media as ChatHistoryMediaItem[];
    expect(outMedia).toHaveLength(2);
    expect(outMedia[0]).toHaveProperty("content", smallContent);
    expect(outMedia[1]).not.toHaveProperty("content");
    expect(outMedia[1]).toMatchObject({ type: "image", fileName: "large.png" });
  });

  it("handles message without role (defaults to assistant)", () => {
    const msg = { content: "test" };
    const result = buildOversizedHistoryPlaceholder(msg, 100_000_000);
    expect(result).toHaveProperty("role", "assistant");
  });

  it("handles null/undefined message (defaults to assistant)", () => {
    const r1 = buildOversizedHistoryPlaceholder(null, 100_000_000);
    expect(r1).toHaveProperty("role", "assistant");
    const r2 = buildOversizedHistoryPlaceholder(undefined, 100_000_000);
    expect(r2).toHaveProperty("role", "assistant");
  });

  it("preserves timestamp from original message", () => {
    const msg = { role: "assistant", timestamp: 1742839208555, content: "test" };
    const result = buildOversizedHistoryPlaceholder(msg, 100_000_000);
    expect(result).toHaveProperty("timestamp", 1742839208555);
  });

  it("returns role from original message when present", () => {
    const msg = { role: "user", content: "hello" };
    const result = buildOversizedHistoryPlaceholder(msg, 100_000_000);
    expect(result).toHaveProperty("role", "user");
  });
});

describe("enforceChatHistoryFinalBudget", () => {
  it("returns original messages when total is under maxBytes", () => {
    const messages = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ];
    const result = enforceChatHistoryFinalBudget({
      messages,
      maxBytes: 10_000,
      outgoingMaxBytes: 100_000_000,
    });
    expect(result.messages).toEqual(messages);
    expect(result.placeholderCount).toBe(0);
  });

  it("returns last message alone when total exceeds maxBytes but last message alone fits", () => {
    const lastMsg = { role: "assistant", content: "hi" };
    const lastSize = jsonUtf8Bytes([lastMsg]);
    const firstMsg = { role: "user", content: "x".repeat(500) };
    const totalSize = jsonUtf8Bytes([firstMsg, lastMsg]);
    const maxBytes = Math.floor((lastSize + totalSize) / 2);

    const result = enforceChatHistoryFinalBudget({
      messages: [firstMsg, lastMsg],
      maxBytes,
      outgoingMaxBytes: 100_000_000,
    });
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toHaveProperty("content", "hi");
    expect(result.placeholderCount).toBe(0);
  });

  it("last message with media survives when no truncation needed", () => {
    const messages = [
      { role: "user", content: "hello" },
      {
        role: "assistant",
        content: "hi",
        media: [
          { type: "file", mimeType: "application/pdf", fileName: "a.pdf", content: "JVBERi" },
        ],
      },
    ];
    const result = enforceChatHistoryFinalBudget({
      messages,
      maxBytes: 10_000,
      outgoingMaxBytes: 100_000_000,
    });
    expect(result.messages).toHaveLength(2);
    expect(result.placeholderCount).toBe(0);
    const last = result.messages[1] as Record<string, unknown>;
    expect(last).toHaveProperty("media");
    expect((last.media as ChatHistoryMediaItem[])[0]).toHaveProperty("content", "JVBERi");
  });

  it("returns empty array for empty messages", () => {
    const result = enforceChatHistoryFinalBudget({
      messages: [],
      maxBytes: 100,
      outgoingMaxBytes: 100_000_000,
    });
    expect(result.messages).toHaveLength(0);
    expect(result.placeholderCount).toBe(0);
  });

  it("buildOversizedHistoryPlaceholder carries media from original message into placeholder", () => {
    // This is the core regression test: when a message with media is replaced by a
    // placeholder, the placeholder must still carry that media (without content if oversized).
    // Use btoa("ab") which gives "YWI=" (4 chars → ~3 bytes decoded)
    const shortBase64 = btoa("ab"); // "YWI="
    const mediaItem = makeMediaItem({
      type: "file",
      mimeType: "application/pdf",
      fileName: "report.pdf",
      content: shortBase64,
    });
    const msg = {
      role: "assistant",
      timestamp: 1742839208555,
      content: "here is your file",
      media: [mediaItem],
    };
    // Use a limit smaller than the decoded size of "ab" (~2 bytes? actually btoa("ab") = "YWI=")
    // atob("YWI=") = "ab" = 2 bytes. So limit=1 should strip it.
    const result = buildOversizedHistoryPlaceholder(msg, 1); // tiny limit → content stripped
    expect(result).toHaveProperty("__openclaw.truncated", true);
    expect(result).toHaveProperty("role", "assistant");
    expect(result).toHaveProperty("timestamp", 1742839208555);
    expect(result).toHaveProperty("media");
    const media = result.media as ChatHistoryMediaItem[];
    expect(media).toHaveLength(1);
    // content is stripped because it exceeds outgoingMaxBytes=1
    expect(media[0]).toMatchObject({
      type: "file",
      mimeType: "application/pdf",
      fileName: "report.pdf",
    });
    expect(media[0]).not.toHaveProperty("content");
  });

  it("buildOversizedHistoryPlaceholder preserves content when within outgoingMaxBytes", () => {
    const mediaItem = makeMediaItem({
      type: "file",
      mimeType: "application/pdf",
      fileName: "report.pdf",
      content: "JVBERi", // small enough to fit in any reasonable limit
    });
    const msg = { role: "assistant", content: "here is your file", media: [mediaItem] };
    const result = buildOversizedHistoryPlaceholder(msg, 100_000_000);
    const media = result.media as ChatHistoryMediaItem[];
    expect(media[0]).toHaveProperty("content", "JVBERi");
  });
});

describe("extractAssistantTextForSilentCheck", () => {
  it("returns undefined for non-assistant messages", () => {
    const msg = {
      role: "tool",
      content: [{ type: "toolCall", id: "1", name: "foo", arguments: {} }],
    };
    expect(extractAssistantTextForSilentCheck(msg)).toBeUndefined();
  });

  it("returns text for assistant message with mixed text and toolCall content (message is kept)", () => {
    const msg = {
      role: "assistant",
      content: [
        { type: "text", text: "hello" },
        { type: "toolCall", id: "1", name: "foo", arguments: {} },
      ],
    };
    // Returns the text, which means isSilentReplyText returns false → message is kept
    expect(extractAssistantTextForSilentCheck(msg)).toBe("hello");
  });

  it("returns SILENT_REPLY_TOKEN for toolCall-only assistant message (no text, no media)", () => {
    const msg = {
      role: "assistant",
      content: [{ type: "toolCall", id: "1", name: "foo", arguments: {} }],
    };
    expect(extractAssistantTextForSilentCheck(msg)).toBe("NO_REPLY");
  });

  it("returns SILENT_REPLY_TOKEN for assistant message with only reasoning block", () => {
    // reasoning blocks are not text and not toolCall, so this returns undefined (kept)
    const msg = { role: "assistant", content: [{ type: "reasoning", text: "thinking..." }] };
    expect(extractAssistantTextForSilentCheck(msg)).toBeUndefined();
  });
});

describe("sanitizeChatHistoryMessages — toolCall-only NO_REPLY (Bug 2)", () => {
  it("drops assistant message with toolCall-only content and no media", () => {
    const messages = [
      { role: "user", content: "send the file" },
      {
        role: "assistant",
        content: [{ type: "toolCall", id: "1", name: "message", arguments: { target: "webchat" } }],
      },
    ];
    const result = sanitizeChatHistoryMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("role", "user");
  });

  it("keeps assistant message with toolCall-only content when media is present", () => {
    const messages = [
      { role: "user", content: "send the file" },
      {
        role: "assistant",
        content: [{ type: "toolCall", id: "1", name: "message", arguments: { target: "webchat" } }],
        media: [
          { type: "file", mimeType: "application/pdf", fileName: "report.pdf", content: "JVBERi" },
        ],
      },
    ];
    const result = sanitizeChatHistoryMessages(messages);
    expect(result).toHaveLength(2);
  });

  it("keeps assistant message with mixed toolCall and text content", () => {
    const messages = [
      { role: "user", content: "send the file" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Sending your file..." },
          { type: "toolCall", id: "1", name: "message", arguments: { target: "webchat" } },
        ],
      },
    ];
    const result = sanitizeChatHistoryMessages(messages);
    expect(result).toHaveLength(2);
  });

  it("keeps non-assistant messages with toolCall content (e.g., tool role)", () => {
    const messages = [
      { role: "user", content: "send the file" },
      {
        role: "tool",
        content: [{ type: "toolCall", id: "1", name: "message", arguments: { target: "webchat" } }],
      },
    ];
    const result = sanitizeChatHistoryMessages(messages);
    expect(result).toHaveLength(2);
  });

  it("drops assistant message with toolCall-only content and text field that is exactly NO_REPLY token", () => {
    const messages = [
      { role: "user", content: "send the file" },
      {
        role: "assistant",
        content: [{ type: "toolCall", id: "1", name: "message", arguments: { target: "webchat" } }],
        text: "NO_REPLY",
      },
    ];
    const result = sanitizeChatHistoryMessages(messages);
    expect(result).toHaveLength(1);
  });

  it("keeps assistant message with toolCall-only content and non-empty text field", () => {
    const messages = [
      { role: "user", content: "send the file" },
      {
        role: "assistant",
        content: [{ type: "toolCall", id: "1", name: "message", arguments: { target: "webchat" } }],
        text: "Please wait",
      },
    ];
    const result = sanitizeChatHistoryMessages(messages);
    expect(result).toHaveLength(2);
  });

  it("drops multiple consecutive toolCall-only assistant messages", () => {
    const messages = [
      { role: "user", content: "send the file" },
      {
        role: "assistant",
        content: [{ type: "toolCall", id: "1", name: "message", arguments: { target: "webchat" } }],
      },
      {
        role: "assistant",
        content: [{ type: "toolCall", id: "2", name: "other", arguments: {} }],
      },
    ];
    const result = sanitizeChatHistoryMessages(messages);
    expect(result).toHaveLength(1);
  });
});
