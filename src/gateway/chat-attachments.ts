import { GATEWAY_RPC_ATTACHMENT_DEFAULT_MAX_BYTES } from "../config/types.gateway.js";
import { estimateBase64DecodedBytes } from "../media/base64.js";
import { sniffMimeFromBase64 } from "../media/sniff-mime-from-base64.js";

export type ChatAttachment = {
  type?: string;
  mimeType?: string;
  fileName?: string;
  content?: unknown;
};

/** Single attachment in unified format (image or non-image) for agent consumption. */
export type UnifiedAttachment = {
  type: string;
  mimeType?: string;
  fileName?: string;
  content: string;
};

export type ChatImageContent = {
  type: "image";
  data: string;
  mimeType: string;
};

export type ParsedMessageWithImages = {
  message: string;
  /** Image-only list for backward compatibility (vision APIs). */
  images: ChatImageContent[];
  /** Unified list of all attachments (image + non-image) for agent pipeline. */
  attachments: UnifiedAttachment[];
};

/** Thrown when attachment validation fails; reason is suitable for RPC client. */
export class AttachmentValidationError extends Error {
  constructor(
    message: string,
    public readonly reason: "size_exceeded" | "invalid_base64" | "type_not_allowed",
  ) {
    super(message);
    this.name = "AttachmentValidationError";
  }
}

type AttachmentLog = {
  warn: (message: string) => void;
};

type NormalizedAttachment = {
  label: string;
  mime: string;
  base64: string;
};

function normalizeMime(mime?: string): string | undefined {
  if (!mime) {
    return undefined;
  }
  const cleaned = mime.split(";")[0]?.trim().toLowerCase();
  return cleaned || undefined;
}

function isImageMime(mime?: string): boolean {
  return typeof mime === "string" && mime.startsWith("image/");
}

function isValidBase64(value: string): boolean {
  // Minimal validation; avoid full decode allocations for large payloads.
  return value.length > 0 && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

/** Returns true if mime matches pattern (e.g. "image/*" or "application/pdf"). */
function mimeMatchesPattern(pattern: string, mime: string): boolean {
  const p = pattern.trim().toLowerCase();
  const m = mime.trim().toLowerCase();
  if (p.endsWith("/*")) {
    return m.startsWith(p.slice(0, -1));
  }
  return p === m;
}

function normalizeAttachment(
  att: ChatAttachment,
  idx: number,
  opts: {
    stripDataUrlPrefix: boolean;
    requireImageMime: boolean;
    mimeAllowlist?: string[];
    mimeBlocklist?: string[];
  },
): NormalizedAttachment {
  const mime = att.mimeType ?? "";
  const content = att.content;
  const label = att.fileName || att.type || `attachment-${idx + 1}`;

  if (typeof content !== "string") {
    throw new AttachmentValidationError(
      `attachment ${label}: content must be base64 string`,
      "invalid_base64",
    );
  }
  if (opts.requireImageMime && !mime.startsWith("image/")) {
    throw new AttachmentValidationError(
      `attachment ${label}: only image/* supported`,
      "type_not_allowed",
    );
  }
  if (opts.mimeBlocklist?.length) {
    const normalizedMime = mime.split(";")[0]?.trim().toLowerCase() ?? "";
    if (opts.mimeBlocklist.some((p) => mimeMatchesPattern(p, normalizedMime))) {
      throw new AttachmentValidationError(
        `attachment ${label}: mime type not allowed (blocklist)`,
        "type_not_allowed",
      );
    }
  }
  if (opts.mimeAllowlist?.length) {
    const normalizedMime = mime.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!opts.mimeAllowlist.some((p) => mimeMatchesPattern(p, normalizedMime))) {
      throw new AttachmentValidationError(
        `attachment ${label}: mime type not allowed (not in allowlist)`,
        "type_not_allowed",
      );
    }
  }

  let base64 = content.trim();
  if (opts.stripDataUrlPrefix) {
    // Strip data URL prefix if present (e.g., "data:image/jpeg;base64,...").
    const dataUrlMatch = /^data:[^;]+;base64,(.*)$/.exec(base64);
    if (dataUrlMatch) {
      base64 = dataUrlMatch[1];
    }
  }
  return { label, mime, base64 };
}

function validateAttachmentBase64OrThrow(
  normalized: NormalizedAttachment,
  opts: { maxBytes: number },
): number {
  if (!isValidBase64(normalized.base64)) {
    throw new AttachmentValidationError(
      `attachment ${normalized.label}: invalid base64 content`,
      "invalid_base64",
    );
  }
  const sizeBytes = estimateBase64DecodedBytes(normalized.base64);
  if (sizeBytes <= 0 || sizeBytes > opts.maxBytes) {
    throw new AttachmentValidationError(
      `attachment ${normalized.label}: exceeds size limit (${sizeBytes} > ${opts.maxBytes} bytes)`,
      "size_exceeded",
    );
  }
  return sizeBytes;
}

/**
 * Parse attachments and return unified list (image + non-image) plus legacy images array.
 * Default per-attachment limit 100 MB; use opts.maxBytes to override.
 * Optional mimeAllowlist/mimeBlocklist enforce MIME policy.
 */
export async function parseMessageWithAttachments(
  message: string,
  attachments: ChatAttachment[] | undefined,
  opts?: {
    maxBytes?: number;
    log?: AttachmentLog;
    mimeAllowlist?: string[];
    mimeBlocklist?: string[];
  },
): Promise<ParsedMessageWithImages> {
  const maxBytes = opts?.maxBytes ?? GATEWAY_RPC_ATTACHMENT_DEFAULT_MAX_BYTES;
  const log = opts?.log;
  if (!attachments || attachments.length === 0) {
    return { message, images: [], attachments: [] };
  }

  const images: ChatImageContent[] = [];
  const unified: UnifiedAttachment[] = [];

  for (const [idx, att] of attachments.entries()) {
    if (!att) {
      continue;
    }
    const normalized = normalizeAttachment(att, idx, {
      stripDataUrlPrefix: true,
      requireImageMime: false,
      mimeAllowlist: opts?.mimeAllowlist,
      mimeBlocklist: opts?.mimeBlocklist,
    });
    validateAttachmentBase64OrThrow(normalized, { maxBytes });
    const { base64: b64, label, mime } = normalized;

    const providedMime = normalizeMime(mime);
    const sniffedMime = normalizeMime(await sniffMimeFromBase64(b64));
    const resolvedMime = sniffedMime ?? providedMime ?? mime;
    if (sniffedMime && providedMime && sniffedMime !== providedMime) {
      log?.warn(
        `attachment ${label}: mime mismatch (${providedMime} -> ${sniffedMime}), using sniffed`,
      );
    }

    const type = isImageMime(resolvedMime) ? "image" : "file";
    unified.push({
      type,
      mimeType: resolvedMime,
      fileName: att.fileName ?? label,
      content: b64,
    });
    if (type === "image") {
      images.push({
        type: "image",
        data: b64,
        mimeType: resolvedMime ?? mime,
      });
    }
  }

  return { message, images, attachments: unified };
}

/**
 * @deprecated Use parseMessageWithAttachments instead.
 * This function converts images to markdown data URLs which Claude API cannot process as images.
 */
export function buildMessageWithAttachments(
  message: string,
  attachments: ChatAttachment[] | undefined,
  opts?: { maxBytes?: number },
): string {
  const maxBytes = opts?.maxBytes ?? 2_000_000; // 2 MB
  if (!attachments || attachments.length === 0) {
    return message;
  }

  const blocks: string[] = [];

  for (const [idx, att] of attachments.entries()) {
    if (!att) {
      continue;
    }
    const normalized = normalizeAttachment(att, idx, {
      stripDataUrlPrefix: false,
      requireImageMime: true,
    });
    validateAttachmentBase64OrThrow(normalized, { maxBytes });
    const { base64, label, mime } = normalized;

    const safeLabel = label.replace(/\s+/g, "_");
    const dataUrl = `![${safeLabel}](data:${mime};base64,${base64})`;
    blocks.push(dataUrl);
  }

  if (blocks.length === 0) {
    return message;
  }
  const separator = message.trim().length > 0 ? "\n\n" : "";
  return `${message}${separator}${blocks.join("\n\n")}`;
}
