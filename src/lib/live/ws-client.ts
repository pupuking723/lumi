export type LiveConnectionStatus =
  | "idle"
  | "connecting"
  | "listening"
  | "responding"
  | "error";

export interface LiveServerEvent {
  type?: string;
  event?: string;
  message?: string;
  text?: string;
  transcript?: string;
  data?: string;
  audio?: string;
  mime_type?: string;
  mimeType?: string;
  done?: boolean;
}

export function getLiveWebSocketUrl(sessionId: string) {
  const path =
    process.env.NEXT_PUBLIC_LUMI_LIVE_WS_PATH ?? "/api/live/gemini/ws";
  const url = new URL(path, window.location.href);
  url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("session_id", sessionId);
  return url.toString();
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
