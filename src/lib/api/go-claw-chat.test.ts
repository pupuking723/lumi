import { describe, expect, it, vi } from "vitest";
import {
  ChatProxyError,
  collectGoClawEventStream,
  extractGoClawAssistantText,
  sendMessageThroughChatProxy,
  toGoClawMessages,
} from "./go-claw-chat";
import type { ChatMessage } from "@/types/lumi";

describe("GoClaw chat adapter", () => {
  it("maps Lumi chat history to OpenAI-compatible messages", () => {
    const history: ChatMessage[] = [
      {
        id: "1",
        conversationId: "conv",
        role: "mochi",
        kind: "text",
        content: "Hi darling.",
        status: "sent",
        createdAt: "2026-05-21T00:00:00.000Z",
      },
    ];

    expect(toGoClawMessages(history, { content: "Color help?" })).toEqual([
      { role: "assistant", content: "Hi darling." },
      { role: "user", content: "Color help?" },
    ]);
  });

  it("extracts assistant content from chat completion responses", () => {
    const text = extractGoClawAssistantText({
      choices: [
        {
          message: {
            role: "assistant",
            content: "Hi darling.",
          },
        },
      ],
    });

    expect(text).toBe("Hi darling.");
  });

  it("collects assistant content from event-stream deltas", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"id":"chatcmpl-test","choices":[{"delta":{"content":"Hi"},"finish_reason":null}]}\n\n',
          ),
        );
        controller.enqueue(
          encoder.encode(
            'data: {"id":"chatcmpl-test","choices":[{"delta":{"content":" there"},"finish_reason":null}]}\n\n',
          ),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    const deltas: string[] = [];

    const result = await collectGoClawEventStream(stream, (delta) =>
      deltas.push(delta),
    );

    expect(result).toEqual({
      content: "Hi there",
      upstreamId: "chatcmpl-test",
    });
    expect(deltas).toEqual(["Hi", " there"]);
  });

  it("throws on invalid event-stream JSON", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("data: nope\n\n"));
        controller.close();
      },
    });

    await expect(collectGoClawEventStream(stream)).rejects.toThrow(
      "GoClaw stream included invalid JSON data.",
    );
  });

  it("aborts an event stream", async () => {
    const controller = new AbortController();
    const stream = new ReadableStream<Uint8Array>({
      start() {
        controller.abort();
      },
    });

    await expect(
      collectGoClawEventStream(stream, undefined, controller.signal),
    ).rejects.toThrow("The chat stream was aborted.");
  });

  it("returns non-stream JSON chat proxy responses", async () => {
    const result = {
      userMessage: {
        id: "user",
        conversationId: "conv",
        role: "user",
        kind: "text",
        content: "Hi",
        status: "sent",
        createdAt: "2026-05-25T00:00:00.000Z",
      },
      assistantMessage: {
        id: "assistant",
        conversationId: "conv",
        role: "mochi",
        kind: "text",
        content: "Hello",
        status: "sent",
        createdAt: "2026-05-25T00:00:00.000Z",
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(result, {
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(
      sendMessageThroughChatProxy("/api/chat/completions", "conv", {
        content: "Hi",
      }),
    ).resolves.toEqual(result);
  });

  it("throws when a stream response has no body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(null, {
          headers: { "content-type": "text/event-stream" },
        }),
      ),
    );

    await expect(
      sendMessageThroughChatProxy("/api/chat/completions", "conv", {
        content: "Hi",
      }),
    ).rejects.toThrow("Chat proxy returned an event stream without a body.");
  });

  it("preserves proxy error status and JSON messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          { error: "Google sign-in is required." },
          { status: 401 },
        ),
      ),
    );

    await expect(
      sendMessageThroughChatProxy("/api/chat/completions", "conv", {
        content: "Hi",
      }),
    ).rejects.toMatchObject({
      name: "ChatProxyError",
      message: "Google sign-in is required.",
      status: 401,
    } satisfies Partial<ChatProxyError>);
  });
});
