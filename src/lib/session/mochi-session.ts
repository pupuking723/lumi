const MOCHI_SESSION_STORAGE_KEY = "lumi.mochi.session_id";

function createSessionId() {
  const random =
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 12);
  return `mochi-${random}`;
}

export function getOrCreateMochiSessionId() {
  if (typeof window === "undefined") return createSessionId();

  const existing = window.localStorage.getItem(MOCHI_SESSION_STORAGE_KEY);
  if (existing) return existing;

  const nextSessionId = createSessionId();
  window.localStorage.setItem(MOCHI_SESSION_STORAGE_KEY, nextSessionId);
  return nextSessionId;
}
