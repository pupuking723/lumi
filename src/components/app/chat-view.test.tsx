import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQueryClient } from "@/test/render";
import { ChatView } from "./chat-view";
import type { SendMessageInput } from "@/types/lumi";

const apiMocks = vi.hoisted(() => ({
  listConversations: vi.fn(),
  createConversation: vi.fn(),
  listMessages: vi.fn(),
  uploadAttachment: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: apiMocks,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/chat",
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

describe("ChatView", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:look");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    apiMocks.listConversations.mockResolvedValue([
      {
        id: "conv-1",
        agentId: "mochi",
        title: "Thread",
        lastMessage: "",
        updatedAt: "2026-05-25T00:00:00.000Z",
      },
    ]);
    apiMocks.createConversation.mockResolvedValue({
      id: "conv-1",
      agentId: "mochi",
      title: "Thread",
      lastMessage: "",
      updatedAt: "2026-05-25T00:00:00.000Z",
    });
    apiMocks.listMessages.mockResolvedValue([]);
    apiMocks.uploadAttachment.mockResolvedValue({
      media_id: "media-1",
      fileName: "look.png",
      mimeType: "image/png",
    });
    apiMocks.sendMessage.mockImplementation(
      async (_conversationId: string, input: SendMessageInput) => {
        input.onAssistantDelta?.("Mochi says ");
        input.onAssistantDelta?.("yes.");
        return {
          userMessage: {
            id: "user-1",
            conversationId: "conv-1",
            role: "user",
            kind: input.attachments?.length ? "image" : "text",
            content: input.content,
            attachments: input.attachments,
            imageUrl: input.imageUrl,
            status: "sent",
            createdAt: "2026-05-25T00:00:00.000Z",
          },
          assistantMessage: {
            id: "assistant-1",
            conversationId: "conv-1",
            role: "mochi",
            kind: "text",
            content: "Mochi says yes.",
            status: "sent",
            createdAt: "2026-05-25T00:00:00.000Z",
          },
        };
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends text messages and renders streaming assistant deltas", async () => {
    renderWithQueryClient(<ChatView />);

    const input = await screen.findByPlaceholderText("Ask Mochi about the look...");
    fireEvent.change(input, { target: { value: "Color help?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("Mochi says yes.")).toBeInTheDocument();
    expect(apiMocks.sendMessage).toHaveBeenCalledWith(
      "conv-1",
      expect.objectContaining({
        content: "Color help?",
        scenario: "text_chat",
        inputContext: expect.objectContaining({ mode: "text" }),
      }),
    );
  });

  it("uploads, removes, and sends image attachments", async () => {
    const { container } = renderWithQueryClient(<ChatView />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    await screen.findByPlaceholderText("Ask Mochi about the look...");
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["image"], "look.png", { type: "image/png" })],
      },
    });

    expect(await screen.findByText("Ready for Mochi")).toBeInTheDocument();
    fireEvent.click(screen.getByText("remove"));
    await waitFor(() => expect(screen.queryByText("Ready for Mochi")).toBeNull());

    fireEvent.change(fileInput, {
      target: {
        files: [new File(["image"], "look.png", { type: "image/png" })],
      },
    });
    expect(await screen.findByText("Ready for Mochi")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Ask Mochi about the look..."), {
      target: { value: "Review this" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() =>
      expect(apiMocks.sendMessage).toHaveBeenCalledWith(
        "conv-1",
        expect.objectContaining({
          content: "Review this",
          scenario: "image_review",
          attachments: [
            expect.objectContaining({
              media_id: "media-1",
              caption: "Review this",
              source: "chat",
              role: "user",
            }),
          ],
          inputContext: expect.objectContaining({
            mode: "multimodal",
            refers_to_media_id: "media-1",
          }),
        }),
      ),
    );
  });

  it("shows retry after send failure and resends the last payload", async () => {
    apiMocks.sendMessage
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementationOnce(async (_conversationId: string, input: SendMessageInput) => ({
        userMessage: {
          id: "user-retry",
          conversationId: "conv-1",
          role: "user",
          kind: "text",
          content: input.content,
          status: "sent",
          createdAt: "2026-05-25T00:00:00.000Z",
        },
        assistantMessage: {
          id: "assistant-retry",
          conversationId: "conv-1",
          role: "mochi",
          kind: "text",
          content: "Retry worked.",
          status: "sent",
          createdAt: "2026-05-25T00:00:00.000Z",
        },
      }));
    renderWithQueryClient(<ChatView />);

    fireEvent.change(
      await screen.findByPlaceholderText("Ask Mochi about the look..."),
      { target: { value: "Help" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    fireEvent.click(await screen.findByText("Retry"));

    expect(await screen.findByText("Retry worked.")).toBeInTheDocument();
    expect(apiMocks.sendMessage).toHaveBeenCalledWith(
      "conv-1",
      expect.objectContaining({ content: "Help" }),
    );
    expect(apiMocks.sendMessage.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
