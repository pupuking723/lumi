import { describe, expect, it } from "vitest";
import {
  base64ToArrayBuffer,
  dataUrlPayload,
  getLiveWebSocketUrl,
  parseLiveEvent,
} from "./ws-client";

describe("Live WebSocket client helpers", () => {
  it("builds a same-origin websocket URL with the session id", () => {
    window.history.pushState({}, "", "/chat");

    const url = new URL(getLiveWebSocketUrl("mochi-session"));
    expect(url.pathname).toBe("/api/live/gemini/ws");
    expect(url.searchParams.get("session_id")).toBe("mochi-session");
    expect(["ws:", "wss:"]).toContain(url.protocol);
  });

  it("parses JSON events and plain text messages", () => {
    expect(parseLiveEvent('{"type":"message","text":"Hi"}')).toEqual({
      type: "message",
      text: "Hi",
    });
    expect(parseLiveEvent("plain hello")).toEqual({
      type: "message",
      text: "plain hello",
    });
    expect(parseLiveEvent(new Blob())).toBeNull();
  });

  it("extracts base64 audio payload metadata from a data URL", () => {
    expect(dataUrlPayload("data:audio/webm;codecs=opus;base64,abc123")).toEqual({
      data: "abc123",
      mimeType: "audio/webm;codecs=opus",
    });
  });

  it("converts base64 audio to an ArrayBuffer", () => {
    const bytes = new Uint8Array(base64ToArrayBuffer(window.btoa("Hi")));

    expect([...bytes]).toEqual([72, 105]);
  });
});
