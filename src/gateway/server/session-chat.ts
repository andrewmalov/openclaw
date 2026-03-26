import { loadConfig } from "../../config/config.js";
import type { ChatEventBroadcast } from "../server-chat.js";

type BlockContent =
  | { type: "text"; text: string }
  | { type: "image"; url: string }
  | { type: "tool_call"; name: string; input: Record<string, unknown> };

export type EmitBlockEventOptions = {
  broadcast: ChatEventBroadcast;
};

type BlockStreamingConfig = {
  blockStreamingDefault?: "off" | "on";
  blockStreamingBreak?: "text_end" | "message_end";
};

/**
 * Creates a function to emit block events to RPC clients for real-time streaming.
 * Block events are only emitted when blockStreamingDefault is "on" in config.
 * Respects blockStreamingBreak setting: "text_end" emits on every text block,
 * "message_end" only emits on the final message.
 */
export function createBlockEventEmitter({ broadcast }: EmitBlockEventOptions) {
  const getBlockStreamingConfig = (): BlockStreamingConfig => {
    try {
      const cfg = loadConfig();
      return {
        blockStreamingDefault: cfg.agents?.defaults?.blockStreamingDefault,
        blockStreamingBreak: cfg.agents?.defaults?.blockStreamingBreak,
      };
    } catch {
      return {};
    }
  };

  const isBlockStreamingEnabled = (): boolean => {
    const config = getBlockStreamingConfig();
    return config.blockStreamingDefault === "on";
  };

  /**
   * Emit a block event to all RPC clients connected to the session.
   * Only emits if block streaming is enabled in config.
   * When blockStreamingBreak is "message_end", intermediate blocks are suppressed.
   */
  const emitBlockEvent = (
    sessionKey: string,
    runId: string,
    block: BlockContent,
    isFinal: boolean,
  ): void => {
    if (!isBlockStreamingEnabled()) {
      return;
    }

    const config = getBlockStreamingConfig();

    // If blockStreamingBreak is "message_end", only emit final blocks
    if (config.blockStreamingBreak === "message_end" && !isFinal) {
      return;
    }

    const payload = {
      sessionKey,
      runId,
      block,
      isFinal,
    };

    broadcast("chat.block", payload, { dropIfSlow: true });
  };

  return { emitBlockEvent };
}
