import { describe, expect, it } from "vitest";
import { extractGoClawAssistantText, toGoClawMessages } from "./go-claw-chat";
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
});
