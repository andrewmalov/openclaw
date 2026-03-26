import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../../config/config.js";
import { createBlockEventEmitter } from "./session-chat.js";

vi.mock("../../config/config.js", () => ({
  loadConfig: vi.fn(),
}));

describe("createBlockEventEmitter", () => {
  beforeEach(() => {
    vi.mocked(loadConfig).mockReset();
  });

  describe("emitBlockEvent", () => {
    it("should broadcast chat.block event with correct structure", () => {
      const broadcast = vi.fn();
      const { emitBlockEvent } = createBlockEventEmitter({ broadcast });

      vi.mocked(loadConfig).mockReturnValue({
        agents: { defaults: { blockStreamingDefault: "on" } },
      });

      emitBlockEvent("agent:main:main", "run-123", { type: "text", text: "Hello" }, false);

      expect(broadcast).toHaveBeenCalledTimes(1);
      expect(broadcast).toHaveBeenCalledWith(
        "chat.block",
        {
          sessionKey: "agent:main:main",
          runId: "run-123",
          block: { type: "text", text: "Hello" },
          isFinal: false,
        },
        { dropIfSlow: true },
      );
    });

    it("should emit final block event with isFinal true", () => {
      const broadcast = vi.fn();
      const { emitBlockEvent } = createBlockEventEmitter({ broadcast });

      vi.mocked(loadConfig).mockReturnValue({
        agents: { defaults: { blockStreamingDefault: "on" } },
      });

      emitBlockEvent("agent:main:main", "run-123", { type: "text", text: "Final message" }, true);

      const call = broadcast.mock.calls[0];
      expect(call[1]).toMatchObject({
        sessionKey: "agent:main:main",
        runId: "run-123",
        block: { type: "text", text: "Final message" },
        isFinal: true,
      });
    });

    it("should NOT broadcast when blockStreamingDefault is not 'on'", () => {
      const broadcast = vi.fn();
      const { emitBlockEvent } = createBlockEventEmitter({ broadcast });

      vi.mocked(loadConfig).mockReturnValue({
        agents: { defaults: { blockStreamingDefault: "off" } },
      });

      emitBlockEvent("agent:main:main", "run-123", { type: "text", text: "Hello" }, false);

      expect(broadcast).not.toHaveBeenCalled();
    });

    it("should NOT broadcast when blockStreamingDefault is undefined", () => {
      const broadcast = vi.fn();
      const { emitBlockEvent } = createBlockEventEmitter({ broadcast });

      vi.mocked(loadConfig).mockReturnValue({});

      emitBlockEvent("agent:main:main", "run-123", { type: "text", text: "Hello" }, false);

      expect(broadcast).not.toHaveBeenCalled();
    });

    it("should suppress intermediate blocks when blockStreamingBreak is 'message_end'", () => {
      const broadcast = vi.fn();
      const { emitBlockEvent } = createBlockEventEmitter({ broadcast });

      vi.mocked(loadConfig).mockReturnValue({
        agents: {
          defaults: {
            blockStreamingDefault: "on",
            blockStreamingBreak: "message_end",
          },
        },
      });

      // Intermediate block should be suppressed
      emitBlockEvent("agent:main:main", "run-123", { type: "text", text: "Part 1" }, false);
      expect(broadcast).not.toHaveBeenCalled();

      // Final block should still be emitted
      emitBlockEvent("agent:main:main", "run-123", { type: "text", text: "Complete" }, true);
      expect(broadcast).toHaveBeenCalledTimes(1);
    });

    it("should emit all blocks when blockStreamingBreak is 'text_end'", () => {
      const broadcast = vi.fn();
      const { emitBlockEvent } = createBlockEventEmitter({ broadcast });

      vi.mocked(loadConfig).mockReturnValue({
        agents: {
          defaults: {
            blockStreamingDefault: "on",
            blockStreamingBreak: "text_end",
          },
        },
      });

      emitBlockEvent("agent:main:main", "run-123", { type: "text", text: "Part 1" }, false);
      emitBlockEvent("agent:main:main", "run-123", { type: "text", text: "Part 2" }, false);

      expect(broadcast).toHaveBeenCalledTimes(2);
    });

    it("should handle config load errors gracefully", () => {
      const broadcast = vi.fn();
      const { emitBlockEvent } = createBlockEventEmitter({ broadcast });

      vi.mocked(loadConfig).mockImplementation(() => {
        throw new Error("Config load failed");
      });

      // Should not throw, should not broadcast
      expect(() => {
        emitBlockEvent("agent:main:main", "run-123", { type: "text", text: "Hello" }, false);
      }).not.toThrow();

      expect(broadcast).not.toHaveBeenCalled();
    });

    it("should emit image block type", () => {
      const broadcast = vi.fn();
      const { emitBlockEvent } = createBlockEventEmitter({ broadcast });

      vi.mocked(loadConfig).mockReturnValue({
        agents: { defaults: { blockStreamingDefault: "on" } },
      });

      emitBlockEvent(
        "agent:main:main",
        "run-123",
        { type: "image", url: "https://example.com/img.png" },
        false,
      );

      const call = broadcast.mock.calls[0];
      expect(call[1].block).toEqual({ type: "image", url: "https://example.com/img.png" });
    });

    it("should emit tool_call block type", () => {
      const broadcast = vi.fn();
      const { emitBlockEvent } = createBlockEventEmitter({ broadcast });

      vi.mocked(loadConfig).mockReturnValue({
        agents: { defaults: { blockStreamingDefault: "on" } },
      });

      emitBlockEvent(
        "agent:main:main",
        "run-123",
        { type: "tool_call", name: "search", input: { query: "test" } },
        false,
      );

      const call = broadcast.mock.calls[0];
      expect(call[1].block).toEqual({
        type: "tool_call",
        name: "search",
        input: { query: "test" },
      });
    });
  });
});
