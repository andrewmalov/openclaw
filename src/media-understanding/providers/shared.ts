import type { GuardedFetchResult } from "../../infra/net/fetch-guard.js";
import { fetchWithSsrFGuard } from "../../infra/net/fetch-guard.js";
import type { LookupFn, SsrFPolicy } from "../../infra/net/ssrf.js";
export { fetchWithTimeout } from "../../utils/fetch-timeout.js";

const MAX_ERROR_CHARS = 300;

export function normalizeBaseUrl(baseUrl: string | undefined, fallback: string): string {
  const raw = baseUrl?.trim() || fallback;
  return raw.replace(/\/+$/, "");
}

export async function fetchWithTimeoutGuarded(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchFn: typeof fetch,
  options?: {
    ssrfPolicy?: SsrFPolicy;
    lookupFn?: LookupFn;
    pinDns?: boolean;
  },
): Promise<GuardedFetchResult> {
  return await fetchWithSsrFGuard({
    url,
    fetchImpl: fetchFn,
    init,
    timeoutMs,
    policy: options?.ssrfPolicy,
    lookupFn: options?.lookupFn,
    pinDns: options?.pinDns,
  });
}

export async function postTranscriptionRequest(params: {
  url: string;
  headers: Headers;
  body: BodyInit;
  timeoutMs: number;
  fetchFn: typeof fetch;
  allowPrivateNetwork?: boolean;
}) {
  return fetchWithTimeoutGuarded(
    params.url,
    {
      method: "POST",
      headers: params.headers,
      body: params.body,
    },
    params.timeoutMs,
    params.fetchFn,
    params.allowPrivateNetwork ? { ssrfPolicy: { allowPrivateNetwork: true } } : undefined,
  );
}

export async function postJsonRequest(params: {
  url: string;
  headers: Headers;
  body: unknown;
  timeoutMs: number;
  fetchFn: typeof fetch;
  allowPrivateNetwork?: boolean;
}) {
  return fetchWithTimeoutGuarded(
    params.url,
    {
      method: "POST",
      headers: params.headers,
      body: JSON.stringify(params.body),
    },
    params.timeoutMs,
    params.fetchFn,
    params.allowPrivateNetwork ? { ssrfPolicy: { allowPrivateNetwork: true } } : undefined,
  );
}

export async function readErrorResponse(res: Response): Promise<string | undefined> {
  try {
    const text = await res.text();
    const collapsed = text.replace(/\s+/g, " ").trim();
    if (!collapsed) {
      return undefined;
    }
    if (collapsed.length <= MAX_ERROR_CHARS) {
      return collapsed;
    }
    return `${collapsed.slice(0, MAX_ERROR_CHARS)}…`;
  } catch {
    return undefined;
  }
}

export async function assertOkOrThrowHttpError(res: Response, label: string): Promise<void> {
  if (res.ok) {
    return;
  }
  const detail = await readErrorResponse(res);
  const suffix = detail ? `: ${detail}` : "";
  throw new Error(`${label} (HTTP ${res.status})${suffix}`);
}

export function requireTranscriptionText(
  value: string | undefined,
  missingMessage: string,
): string {
  const text = value?.trim();
  if (!text) {
    throw new Error(missingMessage);
  }
  return text;
}

/**
 * Maps low-level transcription errors to a short, user-safe message (no secrets).
 */
export function mapTranscriptionFailureToUserMessage(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message;
    if (/aborted|AbortError|User aborted|signal/i.test(msg)) {
      return "Audio transcription timed out. Try again with a shorter clip.";
    }
    if (/fetch failed|ENOTFOUND|ECONNREFUSED|getaddrinfo|network/i.test(msg)) {
      return "Could not reach the transcription service. Check your connection and API settings.";
    }
    if (/HTTP 4\d\d/.test(msg)) {
      return "The transcription service could not process this audio. The file may be unsupported or corrupted.";
    }
    if (/HTTP 5\d\d/.test(msg)) {
      return "The transcription service is temporarily unavailable. Please try again.";
    }
  }
  return "Audio transcription failed. Please try again.";
}
