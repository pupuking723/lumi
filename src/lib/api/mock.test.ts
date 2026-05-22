import { describe, expect, it } from "vitest";
import { createMockClient } from "./mock";

describe("mock Lumi API", () => {
  it("returns Mochi conversations and appends chat responses", async () => {
    const client = createMockClient();
    const [conversation] = await client.listConversations();

    const result = await client.sendMessage(conversation.id, {
      content: "Can you help with color?",
    });
    const messages = await client.listMessages(conversation.id);

    expect(result.assistantMessage.role).toBe("mochi");
    expect(result.assistantMessage.content).toContain("Lilac");
    expect(messages.at(-1)?.id).toBe(result.assistantMessage.id);
  });

  it("creates a private look from a vision analysis", async () => {
    const client = createMockClient();
    const analysis = await client.analyzeVision({
      intent: "main-character",
      imageName: "mirror.png",
    });
    const look = await client.createLook({
      title: "Mirror look",
      analysis,
      visibility: "private",
    });

    expect(look.visibility).toBe("private");
    expect(look.analysis.intent).toBe("main-character");
  });
});
