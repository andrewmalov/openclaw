import { listChannelPlugins } from "../../channels/plugins/index.js";
import type { ChannelPlugin } from "../../channels/plugins/types.js";
import type { OpenClawConfig } from "../../config/config.js";
import { defaultRuntime } from "../../runtime.js";
import {
  INTERNAL_MESSAGE_CHANNEL,
  listDeliverableMessageChannels,
  type GatewayMessageChannel,
  isDeliverableMessageChannel,
  isInternalMessageChannel,
  normalizeMessageChannel,
} from "../../utils/message-channel.js";
import { resolveOutboundChannelPlugin } from "./channel-resolution.js";

/** Includes internal orchestrator/webchat surface for tool channel resolution. */
export type MessageChannelId = GatewayMessageChannel;
export type MessageChannelSelectionSource =
  | "explicit"
  | "tool-context-fallback"
  | "single-configured";

const getMessageChannels = () => listDeliverableMessageChannels();

function isKnownChannel(value: string): boolean {
  return getMessageChannels().includes(value as MessageChannelId);
}

function resolveKnownChannel(value?: string | null): MessageChannelId | undefined {
  const normalized = normalizeMessageChannel(value);
  if (!normalized) {
    return undefined;
  }
  if (!isDeliverableMessageChannel(normalized)) {
    return undefined;
  }
  if (!isKnownChannel(normalized)) {
    return undefined;
  }
  return normalized as MessageChannelId;
}

function resolveAvailableKnownChannel(params: {
  cfg: OpenClawConfig;
  value?: string | null;
}): MessageChannelId | undefined {
  const normalized = resolveKnownChannel(params.value);
  if (!normalized) {
    return undefined;
  }
  return resolveOutboundChannelPlugin({
    channel: normalized,
    cfg: params.cfg,
  })
    ? normalized
    : undefined;
}

function resolveInternalWebchatFromContext(
  value?: string | null,
): typeof INTERNAL_MESSAGE_CHANNEL | undefined {
  return isInternalMessageChannel(value) ? INTERNAL_MESSAGE_CHANNEL : undefined;
}

function isAccountEnabled(account: unknown): boolean {
  if (!account || typeof account !== "object") {
    return true;
  }
  const enabled = (account as { enabled?: boolean }).enabled;
  return enabled !== false;
}

const loggedChannelSelectionErrors = new Set<string>();

function logChannelSelectionError(params: {
  pluginId: string;
  accountId: string;
  operation: "resolveAccount" | "isConfigured";
  error: unknown;
}) {
  const message = params.error instanceof Error ? params.error.message : String(params.error);
  const key = `${params.pluginId}:${params.accountId}:${params.operation}:${message}`;
  if (loggedChannelSelectionErrors.has(key)) {
    return;
  }
  loggedChannelSelectionErrors.add(key);
  defaultRuntime.error?.(
    `[channel-selection] ${params.pluginId}(${params.accountId}) ${params.operation} failed: ${message}`,
  );
}

async function isPluginConfigured(plugin: ChannelPlugin, cfg: OpenClawConfig): Promise<boolean> {
  const accountIds = plugin.config.listAccountIds(cfg);
  if (accountIds.length === 0) {
    return false;
  }

  for (const accountId of accountIds) {
    let account: unknown;
    try {
      account = plugin.config.resolveAccount(cfg, accountId);
    } catch (error) {
      logChannelSelectionError({
        pluginId: plugin.id,
        accountId,
        operation: "resolveAccount",
        error,
      });
      continue;
    }
    const enabled = plugin.config.isEnabled
      ? plugin.config.isEnabled(account, cfg)
      : isAccountEnabled(account);
    if (!enabled) {
      continue;
    }
    if (!plugin.config.isConfigured) {
      return true;
    }
    let configured = false;
    try {
      configured = await plugin.config.isConfigured(account, cfg);
    } catch (error) {
      logChannelSelectionError({
        pluginId: plugin.id,
        accountId,
        operation: "isConfigured",
        error,
      });
      continue;
    }
    if (configured) {
      return true;
    }
  }

  return false;
}

export async function listConfiguredMessageChannels(
  cfg: OpenClawConfig,
): Promise<MessageChannelId[]> {
  const channels: MessageChannelId[] = [];
  for (const plugin of listChannelPlugins()) {
    if (!isKnownChannel(plugin.id)) {
      continue;
    }
    if (await isPluginConfigured(plugin, cfg)) {
      channels.push(plugin.id);
    }
  }
  return channels;
}

export async function resolveMessageChannelSelection(params: {
  cfg: OpenClawConfig;
  channel?: string | null;
  fallbackChannel?: string | null;
}): Promise<{
  channel: MessageChannelId;
  configured: MessageChannelId[];
  source: MessageChannelSelectionSource;
}> {
  const normalized = normalizeMessageChannel(params.channel);
  if (normalized) {
    if (isInternalMessageChannel(normalized)) {
      return {
        channel: INTERNAL_MESSAGE_CHANNEL,
        configured: await listConfiguredMessageChannels(params.cfg),
        source: "explicit",
      };
    }

    const availableExplicit = resolveAvailableKnownChannel({
      cfg: params.cfg,
      value: normalized,
    });
    if (!availableExplicit) {
      const fallback = resolveAvailableKnownChannel({
        cfg: params.cfg,
        value: params.fallbackChannel,
      });
      if (fallback) {
        return {
          channel: fallback,
          configured: await listConfiguredMessageChannels(params.cfg),
          source: "tool-context-fallback",
        };
      }
      const webchatFallback = resolveInternalWebchatFromContext(params.fallbackChannel);
      if (webchatFallback) {
        return {
          channel: webchatFallback,
          configured: await listConfiguredMessageChannels(params.cfg),
          source: "tool-context-fallback",
        };
      }
      if (!isKnownChannel(normalized)) {
        throw new Error(`Unknown channel: ${String(normalized)}`);
      }
      throw new Error(`Channel is unavailable: ${String(normalized)}`);
    }
    return {
      channel: availableExplicit,
      configured: await listConfiguredMessageChannels(params.cfg),
      source: "explicit",
    };
  }

  const fallback = resolveAvailableKnownChannel({
    cfg: params.cfg,
    value: params.fallbackChannel,
  });
  if (fallback) {
    return {
      channel: fallback,
      configured: await listConfiguredMessageChannels(params.cfg),
      source: "tool-context-fallback",
    };
  }

  const webchatFromContext = resolveInternalWebchatFromContext(params.fallbackChannel);
  if (webchatFromContext) {
    return {
      channel: webchatFromContext,
      configured: await listConfiguredMessageChannels(params.cfg),
      source: "tool-context-fallback",
    };
  }

  const configured = await listConfiguredMessageChannels(params.cfg);
  if (configured.length === 1) {
    return { channel: configured[0], configured, source: "single-configured" };
  }
  if (configured.length === 0) {
    throw new Error("Channel is required (no configured channels detected).");
  }
  throw new Error(
    `Channel is required when multiple channels are configured: ${configured.join(", ")}`,
  );
}

export const __testing = {
  resetLoggedChannelSelectionErrors() {
    loggedChannelSelectionErrors.clear();
  },
};
