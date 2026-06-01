import { describe, expect, it, vi } from "vitest";
import {
  ChatProxyError,
  collectGoClawEventStream,
  deleteSessionThroughChatProxy,
  extractGoClawAssistantText,
  fetchMessagesThroughChatProxy,
  sendMessageThroughChatProxy,
  toGoClawMessages,
  toLumiChatMessages,
} from "./go-claw-chat";
import type { ChatMessage } from "@/types/lumi";

describe("GoClaw chat adapter", () => {
  const ootdReportJson = JSON.stringify({
    todayJudgment: {
      title: "Quiet office polish",
      score: 8,
      label: "Polished",
      summary: "A clean outfit report.",
    },
    overallStyle: "Minimal commute",
    highlights: ["Clean contrast"],
    biggestIssue: "The bag feels too formal.",
    suggestions: [{ title: "Loosen it", body: "Swap the bag." }],
    mochiLine: "Good bones, lighter hand.",
  });

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

  it("maps GoClaw session history to Lumi chat messages", () => {
    expect(
      toLumiChatMessages("conv", {
        messages: [
          {
            id: "u1",
            role: "user",
            content:
              "<media:image>\n\n<mochi_multimodal_context>\n- scenario: image_review\n</mochi_multimodal_context>\n\nDoes this work?",
            created_at: "2026-05-27T03:10:00Z",
            media_refs: [
              {
                id: "media-1",
                kind: "image",
                mime_type: "image/png",
                preview_url: "https://cdn.example.com/look.png",
              },
            ],
          },
          {
            id: "a1",
            role: "assistant",
            content: "Yes, sharpen the shoe.",
          },
          {
            id: "tool1",
            role: "tool",
            content: "internal",
          },
        ],
      }),
    ).toEqual([
      {
        id: "u1",
        conversationId: "conv",
        role: "user",
        kind: "image",
        content: "Does this work?",
        imageUrl: "https://cdn.example.com/look.png",
        attachments: [
          {
            media_id: "media-1",
            source: "chat",
            role: "user",
            previewUrl: "https://cdn.example.com/look.png",
            mimeType: "image/png",
          },
        ],
        status: "sent",
        createdAt: "2026-05-27T03:10:00Z",
      },
      {
        id: "a1",
        conversationId: "conv",
        role: "mochi",
        kind: "text",
        content: "Yes, sharpen the shoe.",
        imageUrl: undefined,
        attachments: undefined,
        status: "sent",
        createdAt: expect.any(String),
      },
    ]);
  });

  it("extracts image urls from embedded media tags in session history", () => {
    expect(
      toLumiChatMessages("conv", {
        messages: [
          {
            id: "u1",
            role: "user",
            content:
              '<media:image url="https://cdn.example.com/upload.jpg?X-Amz-Signature=test" id="media-1">\n\n<mochi_multimodal_context>\n- scenario: image_review\n</mochi_multimodal_context>\n\nReview this',
            created_at: "2026-05-28T06:48:32Z",
          },
        ],
      }),
    ).toEqual([
      {
        id: "u1",
        conversationId: "conv",
        role: "user",
        kind: "image",
        content: "Review this",
        imageUrl: "https://cdn.example.com/upload.jpg?X-Amz-Signature=test",
        attachments: [
          {
            media_id: "media-1",
            source: "chat",
            role: "user",
            previewUrl: "https://cdn.example.com/upload.jpg?X-Amz-Signature=test",
          },
        ],
        status: "sent",
        createdAt: "2026-05-28T06:48:32Z",
      },
    ]);
  });

  it("filters OOTD report JSON out of chat history", () => {
    const history: ChatMessage[] = [
      {
        id: "1",
        conversationId: "conv",
        role: "mochi",
        kind: "text",
        content: ootdReportJson,
        status: "sent",
        createdAt: "2026-05-21T00:00:00.000Z",
      },
      {
        id: "2",
        conversationId: "conv",
        role: "user",
        kind: "text",
        content: "What shoes should I wear?",
        status: "sent",
        createdAt: "2026-05-21T00:00:01.000Z",
      },
    ];

    expect(toGoClawMessages(history, { content: "Anything else?" })).toEqual([
      { role: "user", content: "What shoes should I wear?" },
      { role: "user", content: "Anything else?" },
    ]);
  });

  it("filters partial OOTD report JSON out of chat history", () => {
    const history: ChatMessage[] = [
      {
        id: "1",
        conversationId: "conv",
        role: "mochi",
        kind: "text",
        content: '{"todayJudgment":{"title":"Still rendering"',
        status: "sent",
        createdAt: "2026-05-21T00:00:00.000Z",
      },
    ];

    expect(toGoClawMessages(history, { content: "Retry plainly" })).toEqual([
      { role: "user", content: "Retry plainly" },
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

  it("throws on event-stream error payloads instead of returning assistant text", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"error":{"message":"The upstream model stream was interrupted."}}\n\n',
          ),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    await expect(collectGoClawEventStream(stream)).rejects.toThrow(
      "The upstream model stream was interrupted.",
    );
  });

  it("throws on legacy streamed provider errors instead of surfacing raw URLs", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"id":"chatcmpl-test","choices":[{"delta":{"content":"Error: iter 1 think: llm call: Post \\"https://us-central1-aiplatform.googleapis.com/v1/projects/demo/models/gemini:streamGenerateContent?alt=sse\\": unexpected EOF"},"finish_reason":null}]}\n\n',
          ),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    await expect(collectGoClawEventStream(stream)).rejects.toThrow(
      "Mochi lost the model connection. Please retry.",
    );
  });

  it("throws when a stream returns an OOTD report instead of chat text", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: {"id":"chatcmpl-test","choices":[{"delta":{"content":${JSON.stringify(ootdReportJson)}},"finish_reason":null}]}\n\n`,
          ),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    await expect(collectGoClawEventStream(stream)).rejects.toThrow(
      "Mochi returned a report instead of a chat reply. Please retry.",
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

  it("fetches session messages through the messages proxy", async () => {
    vi.stubGlobal("location", { origin: "https://lumi.test" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          messages: [{ id: "a1", role: "assistant", content: "Hello" }],
        }),
      ),
    );

    const messages = await fetchMessagesThroughChatProxy(
      "/api/chat/messages",
      "conv",
      "mochi-1",
    );

    expect(fetch).toHaveBeenCalledWith(
      "https://lumi.test/api/chat/messages?session_id=mochi-1",
      expect.objectContaining({ method: "GET" }),
    );
    expect(messages[0]).toEqual(
      expect.objectContaining({
        id: "a1",
        role: "mochi",
        content: "Hello",
      }),
    );
  });

  it("deletes a session through the sessions proxy", async () => {
    vi.stubGlobal("location", { origin: "https://lumi.test" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );

    await deleteSessionThroughChatProxy("/api/chat/sessions", "mochi-1");

    expect(fetch).toHaveBeenCalledWith(
      "https://lumi.test/api/chat/sessions?session_id=mochi-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("preserves the user's prompt on image chat messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          'data: {"id":"chatcmpl-image","choices":[{"delta":{"content":"This works for a casual gallery day."},"finish_reason":null}]}\n\ndata: [DONE]\n\n',
          {
            headers: { "content-type": "text/event-stream" },
          },
        ),
      ),
    );

    const result = await sendMessageThroughChatProxy(
      "/api/chat/completions",
      "conv",
      {
        content: "这个穿搭适合什么",
        imageUrl: "blob:test",
        attachments: [
          {
            media_id: "media-1",
            source: "chat",
            role: "user",
          },
        ],
      },
    );

    expect(result.userMessage.content).toBe("这个穿搭适合什么");
    expect(result.userMessage.kind).toBe("image");
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
