/**
 * In-memory store for messagingToolSentMediaUrls from completed agent runs.
 * Used by chat.history to inject message-tool inline relay media into assistant messages.
 * Evicts entries older than 5 minutes to avoid unbounded growth.
 */

const TTL_MS = 5 * 60 * 1000;

export type SessionRunMediaEntry = {
  runId: string;
  mediaUrls: string[];
  ts: number;
};

const store = new Map<string, SessionRunMediaEntry>();

function evictStale(): void {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now - entry.ts > TTL_MS) {
      store.delete(key);
    }
  }
}

export function storeSessionRunMedia(sessionKey: string, runId: string, mediaUrls: string[]): void {
  const filtered = mediaUrls.filter((u) => typeof u === "string" && u.trim().length > 0);
  if (filtered.length === 0) {
    return;
  }
  evictStale();
  store.set(sessionKey, { runId, mediaUrls: filtered, ts: Date.now() });
}

export function getSessionRunMedia(sessionKey: string): SessionRunMediaEntry | undefined {
  const entry = store.get(sessionKey);
  if (!entry) {
    return undefined;
  }
  if (Date.now() - entry.ts > TTL_MS) {
    store.delete(sessionKey);
    return undefined;
  }
  return entry;
}

/** Remove stored media for a session key. Used for tests and explicit cleanup. */
export function clearSessionRunMedia(sessionKey: string): void {
  store.delete(sessionKey);
}
