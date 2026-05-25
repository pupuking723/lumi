export type LiveConnectionStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "speaking"
  | "thinking"
  | "responding"
  | "error";

export interface LiveServerEvent {
  type?: string;
  event?: string;
  role?: "user" | "assistant" | string;
  content?: string;
  error?: string;
  message?: string;
  text?: string;
  transcript?: string;
  data?: string | { data?: string; mime_type?: string; mimeType?: string; [key: string]: unknown };
  audio?: string;
  mime_type?: string;
  mimeType?: string;
  done?: boolean;
}

export function getLiveWebSocketUrl(sessionId: string) {
  const endpoint =
    process.env.NEXT_PUBLIC_LUMI_LIVE_WS_URL ??
    process.env.NEXT_PUBLIC_LUMI_LIVE_WS_PATH ?? "/api/live/gemini/ws";

  const url = new URL(endpoint, window.location.href);
  if (url.protocol === "http:" || url.protocol === "https:") {
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  } else if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  }

  url.searchParams.set("session_id", sessionId);
  return url.toString();
}

export async function prepareLiveWebSocketSession() {
  const path =
    process.env.NEXT_PUBLIC_LUMI_LIVE_SESSION_PATH ?? "/api/live/session";
  if (path === "off") return;

  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      message || `Live session cookie setup failed with ${response.status}`,
    );
  }
}

export function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function dataUrlPayload(dataUrl: string) {
  const [header, data] = dataUrl.split(",");
  const mimeType = header.match(/^data:(.*?);base64$/)?.[1] ?? "audio/webm";
  return { data, mimeType };
}

export function parseLiveEvent(data: unknown): LiveServerEvent | null {
  if (typeof data !== "string") return null;

  try {
    return JSON.parse(data) as LiveServerEvent;
  } catch {
    return {
      type: "message",
      text: data,
    };
  }
}

export function base64ToArrayBuffer(base64: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return window.btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function sampleRateFromMime(mime: string): number {
  const match = /(?:^|;)rate=(\d+)/i.exec(mime);
  return match ? Number.parseInt(match[1], 10) : 0;
}
