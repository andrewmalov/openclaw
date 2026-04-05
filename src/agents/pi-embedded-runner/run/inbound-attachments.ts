import fs from "node:fs/promises";
import path from "node:path";
import type { MsgContext } from "../../../auto-reply/templating.js";
import type { OpenClawConfig } from "../../../config/config.js";
import { runAudioTranscription } from "../../../media-understanding/audio-transcription-runner.js";
import type { ActiveMediaModel } from "../../../media-understanding/runner.js";
import { normalizeMimeType } from "../../../media/mime.js";
import { log } from "../logger.js";

export type RpcInboundAttachment = {
  type: string;
  mimeType?: string;
  fileName?: string;
  content: string;
};

/** Whether `tools.media.audio` allows automatic transcription (matches media-understanding gate). */
export function shouldTranscribeInboundAudio(cfg: OpenClawConfig | undefined): boolean {
  return Boolean(cfg && cfg.tools?.media?.audio?.enabled !== false);
}

export function isRpcAudioMime(mimeType: string | undefined): boolean {
  const mime = normalizeMimeType(mimeType ?? "");
  return Boolean(mime?.startsWith("audio/"));
}

/** Safe filename for inbound attachment: no path separators or control chars. */
function safeAttachmentBasename(name: string | undefined, idx: number): string {
  const base = (name ?? `attachment-${idx}`).trim() || `attachment-${idx}`;
  let noControl = "";
  for (let i = 0; i < base.length; i++) {
    const code = base.charCodeAt(i);
    noControl += code <= 31 || code === 127 ? "_" : base[i];
  }
  const noPath = path.basename(noControl).replace(/[/\\<>:"|?*\s]+/g, "_");
  return noPath.slice(0, 200) || `attachment-${idx}`;
}

/**
 * Writes non-image attachments to the workspace and returns the legacy read_file prompt prefix.
 */
async function materializeFilesToWorkspace(
  workspaceDir: string,
  runId: string,
  attachments: RpcInboundAttachment[],
): Promise<string> {
  if (attachments.length === 0) {
    return "";
  }
  const relDir = path.join(".openclaw", "inbound-attachments", runId);
  const absDir = path.join(workspaceDir, relDir);
  await fs.mkdir(absDir, { recursive: true });
  const lines: string[] = ["The following files were attached (use read_file to read them):"];
  for (let i = 0; i < attachments.length; i++) {
    const att = attachments[i];
    const name = safeAttachmentBasename(att.fileName, i);
    const absPath = path.join(absDir, name);
    const buf = Buffer.from(att.content, "base64");
    await fs.writeFile(absPath, buf, { mode: 0o644 });
    lines.push(`- ${absPath}`);
  }
  return `${lines.join("\n")}\n\n`;
}

/**
 * Gateway/RPC `agent` runs use the embedded Pi path, which historically materialized all
 * non-image attachments as workspace files only. Channel auto-reply runs `applyMediaUnderstanding`
 * first, which transcribes audio when `tools.media.audio` allows it. Align RPC ingress with that
 * behavior so voice notes become text in the prompt instead of relying on read_file of binary audio.
 */
export async function buildInboundAttachmentPromptPrefix(params: {
  workspaceDir: string;
  runId: string;
  attachments: RpcInboundAttachment[];
  cfg: OpenClawConfig | undefined;
  agentDir: string | undefined;
  activeModel: ActiveMediaModel | undefined;
  sessionKey: string | undefined;
  messageChannel: string | undefined;
  messageProvider: string | undefined;
}): Promise<string> {
  const nonImage = params.attachments.filter((a) => a.type !== "image");
  if (nonImage.length === 0) {
    return "";
  }

  const cfg = params.cfg;
  const audioGloballyEnabled = shouldTranscribeInboundAudio(cfg);

  const audioAtts: RpcInboundAttachment[] = [];
  const fileAtts: RpcInboundAttachment[] = [];
  for (const att of nonImage) {
    if (isRpcAudioMime(att.mimeType) && audioGloballyEnabled) {
      audioAtts.push(att);
    } else {
      fileAtts.push(att);
    }
  }

  const parts: string[] = [];
  let audioFallback: RpcInboundAttachment[] = [];

  if (audioAtts.length > 0 && cfg) {
    const audioCtx: MsgContext = {
      InboundAttachments: audioAtts,
      SessionKey: params.sessionKey,
      Provider: params.messageChannel ?? params.messageProvider,
    };
    try {
      const { transcript } = await runAudioTranscription({
        ctx: audioCtx,
        cfg,
        agentDir: params.agentDir,
        activeModel: params.activeModel,
      });
      if (transcript?.trim()) {
        parts.push(`Voice message transcription:\n${transcript.trim()}\n`);
      } else {
        audioFallback = audioAtts;
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      log.warn(`inbound audio transcription failed: ${detail}`);
      audioFallback = audioAtts;
    }
  }

  const toMaterialize = [...fileAtts, ...audioFallback];
  if (toMaterialize.length > 0) {
    parts.push(await materializeFilesToWorkspace(params.workspaceDir, params.runId, toMaterialize));
  }

  return parts.filter(Boolean).join("\n");
}
