import { describe, expect, it } from "vitest";
import {
  collectGoClawEventStream,
  extractGoClawAssistantText,
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
});
