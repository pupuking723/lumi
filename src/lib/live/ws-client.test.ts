import { afterEach, describe, expect, it, vi } from "vitest";
import {
  base64ToArrayBuffer,
  dataUrlPayload,
  getLiveWebSocketUrl,
  parseLiveEvent,
  prepareLiveWebSocketSession,
} from "./ws-client";

describe("Live WebSocket client helpers", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_LUMI_LIVE_WS_URL;
    delete process.env.NEXT_PUBLIC_LUMI_LIVE_SESSION_PATH;
  });

  it("builds a direct GoClaw websocket URL with the session id", () => {
    window.history.pushState({}, "", "/chat");

    const url = new URL(getLiveWebSocketUrl("mochi-session"));
    expect(url.hostname).toBe(window.location.hostname);
    expect(url.port).toBe("9600");
    expect(url.pathname).toBe("/v1/closy/live/gemini/ws");
    expect(url.searchParams.get("session_id")).toBe("mochi-session");
    expect(["ws:", "wss:"]).toContain(url.protocol);
  });

  it("uses an absolute websocket URL when configured", () => {
    process.env.NEXT_PUBLIC_LUMI_LIVE_WS_URL =
      "wss://api.example.test/v1/closy/live/gemini/ws?token=abc";

    const url = new URL(getLiveWebSocketUrl("mochi-session"));
    expect(url.origin).toBe("wss://api.example.test");
    expect(url.pathname).toBe("/v1/closy/live/gemini/ws");
    expect(url.searchParams.get("token")).toBe("abc");
    expect(url.searchParams.get("session_id")).toBe("mochi-session");
  });

  it("converts an absolute http URL to a websocket URL", () => {
    process.env.NEXT_PUBLIC_LUMI_LIVE_WS_URL =
      "https://api.example.test/v1/closy/live/gemini/ws";

    const url = new URL(getLiveWebSocketUrl("mochi-session"));
    expect(url.protocol).toBe("wss:");
    expect(url.pathname).toBe("/v1/closy/live/gemini/ws");
  });

  it("keeps local websocket URLs on the current loopback host for cookies", () => {
    window.history.pushState({}, "", "/chat");
    const configuredHost =
      window.location.hostname === "localhost" ? "127.0.0.1" : "localhost";
    process.env.NEXT_PUBLIC_LUMI_LIVE_WS_URL =
      `ws://${configuredHost}:9600/v1/closy/live/gemini/ws`;

    const url = new URL(getLiveWebSocketUrl("mochi-session"));

    expect(url.hostname).toBe(window.location.hostname);
    expect(url.port).toBe("9600");
  });

  it("prepares the server-set live cookie before connecting", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);

    await prepareLiveWebSocketSession();

    expect(fetchMock).toHaveBeenCalledWith("/api/live/session", {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
  });

  it("can skip live cookie preparation", async () => {
    process.env.NEXT_PUBLIC_LUMI_LIVE_SESSION_PATH = "off";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await prepareLiveWebSocketSession();

    expect(fetchMock).not.toHaveBeenCalled();
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
