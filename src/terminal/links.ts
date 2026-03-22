import { formatTerminalLink } from "../utils.js";

export const DOCS_ROOT = "https://github.com/andrewmalov/openclaw";

export function formatDocsLink(
  path: string,
  label?: string,
  opts?: { fallback?: string; force?: boolean },
): string {
  const trimmed = path.trim();
  let url: string;
  if (trimmed.startsWith("http")) {
    url = trimmed.startsWith("https://docs.openclaw.ai") ? DOCS_ROOT : trimmed;
  } else {
    url = DOCS_ROOT;
  }
  return formatTerminalLink(label ?? url, url, {
    fallback: opts?.fallback ?? url,
    force: opts?.force,
  });
}

export function formatDocsRootLink(label?: string): string {
  return formatTerminalLink(label ?? DOCS_ROOT, DOCS_ROOT, {
    fallback: DOCS_ROOT,
  });
}
