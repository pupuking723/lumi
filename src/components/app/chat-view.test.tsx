import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQueryClient } from "@/test/render";
import { ChatView } from "./chat-view";
import { ChatProxyError } from "@/lib/api/go-claw-chat";
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
    vi.clearAllMocks();
    window.localStorage.clear();
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "google-client";
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

    const input = await screen.findByPlaceholderText("Ask Mochi...");
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

  it("sends on Enter and keeps Shift Enter for multiline drafts", async () => {
    renderWithQueryClient(<ChatView />);

    const input = await screen.findByPlaceholderText("Ask Mochi...");
    fireEvent.change(input, { target: { value: "Line one" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter", shiftKey: true });

    expect(apiMocks.sendMessage).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => expect(apiMocks.sendMessage).toHaveBeenCalledTimes(1));
    expect(apiMocks.sendMessage).toHaveBeenCalledWith(
      "conv-1",
      expect.objectContaining({
        content: "Line one",
        scenario: "text_chat",
      }),
    );
  });

  it("prompts users to sign in when message sending is unauthenticated", async () => {
    apiMocks.sendMessage.mockRejectedValueOnce(
      new ChatProxyError("Google sign-in is required.", 401),
    );

    renderWithQueryClient(<ChatView />);

    const input = await screen.findByPlaceholderText("Ask Mochi...");
    fireEvent.change(input, { target: { value: "你好" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(
      await screen.findByText("Sign in to send messages to Mochi."),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Sign in" }).length).toBeGreaterThan(1);
    expect(screen.queryByText("The thread snagged.")).not.toBeInTheDocument();
  });

  it("uploads, removes, and sends image attachments", async () => {
    const { container } = renderWithQueryClient(<ChatView />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    await screen.findByPlaceholderText("Ask Mochi...");
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
    fireEvent.change(screen.getByPlaceholderText("Ask Mochi..."), {
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

  it("sends image uploads directly to the live agent while voice is active", async () => {
    const sentPayloads: string[] = [];
    class MockWebSocket extends EventTarget {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSED = 3;

      readyState = MockWebSocket.CONNECTING;

      constructor() {
        super();
        setTimeout(() => {
          this.readyState = MockWebSocket.OPEN;
          this.dispatchEvent(new Event("open"));
          this.dispatchEvent(
            new MessageEvent("message", {
              data: JSON.stringify({ type: "live_setup_complete" }),
            }),
          );
        }, 0);
      }

      send(payload: string) {
        sentPayloads.push(payload);
      }

      close() {
        this.readyState = MockWebSocket.CLOSED;
        this.dispatchEvent(new CloseEvent("close"));
      }
    }

    class MockAudioContext {
      state = "running";
      sampleRate = 48000;
      destination = {};

      resume() {
        return Promise.resolve();
      }

      close() {
        return Promise.resolve();
      }

      createMediaStreamSource() {
        return { connect: vi.fn(), disconnect: vi.fn() };
      }

      createAnalyser() {
        return {
          fftSize: 256,
          smoothingTimeConstant: 0.72,
          frequencyBinCount: 8,
          getByteFrequencyData: (data: Uint8Array) => data.fill(0),
        };
      }

      createScriptProcessor() {
        return { connect: vi.fn(), disconnect: vi.fn(), onaudioprocess: null };
      }
    }

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 }),
    );
    Object.defineProperty(window, "WebSocket", {
      value: MockWebSocket,
      configurable: true,
    });
    Object.defineProperty(window, "AudioContext", {
      value: MockAudioContext,
      configurable: true,
    });
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
          getAudioTracks: () => [{ label: "Mic" }],
        }),
      },
      configurable: true,
    });

    const { container } = renderWithQueryClient(<ChatView />);
    await screen.findByPlaceholderText("Ask Mochi...");
    fireEvent.click(screen.getByRole("button", { name: "Start live voice chat" }));

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const sendMessageCallsBeforeUpload = apiMocks.sendMessage.mock.calls.length;
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["image"], "voice-look.png", { type: "image/png" })],
      },
    });

    await waitFor(() =>
      expect(sentPayloads.some((payload) => payload.includes('"type":"media"'))).toBe(
        true,
      ),
    );
    expect(sentPayloads).toContainEqual(
      JSON.stringify({
        type: "media",
        media_id: "media-1",
        caption: "Outfit image for Mochi to review",
        source: "chat",
        role: "user",
        turn_complete: false,
      }),
    );
    expect(screen.queryByText("Ready for Mochi")).toBeNull();
    expect(screen.queryByText("Uploading...")).toBeNull();
    expect(apiMocks.sendMessage.mock.calls.length).toBe(
      sendMessageCallsBeforeUpload,
    );
  });

  it("renders message images at a fixed width and opens a fullscreen preview", async () => {
    apiMocks.listMessages.mockResolvedValue([
      {
        id: "user-image",
        conversationId: "conv-1",
        role: "user",
        kind: "image",
        content: "Review this",
        imageUrl: "blob:look",
        status: "sent",
        createdAt: "2026-05-25T00:00:00.000Z",
      },
    ]);
    renderWithQueryClient(<ChatView />);

    const image = await screen.findByAltText("Uploaded outfit preview");
    const imageButton = screen.getByRole("button", {
      name: "Open image preview",
    });

    expect(imageButton).toHaveStyle({
      width: "220px",
      maxWidth: "100%",
    });
    expect(image).toHaveStyle({ width: "100%" });
    expect(image).toHaveClass("h-auto");
    expect(imageButton).not.toHaveClass("aspect-[4/3]");

    fireEvent.click(imageButton);

    const preview = screen.getByRole("dialog", { name: "Image preview" });
    expect(preview).toBeInTheDocument();
    expect(screen.getAllByAltText("Uploaded outfit preview")).toHaveLength(2);

    fireEvent.click(screen.getAllByAltText("Uploaded outfit preview")[1]);
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Image preview" })).toBeNull(),
    );
  });

  it("closes the image preview with Escape and falls back for undisplayable image urls", async () => {
    apiMocks.listMessages.mockResolvedValue([
      {
        id: "user-image",
        conversationId: "conv-1",
        role: "user",
        kind: "image",
        content: "Review this",
        imageUrl: "media-1",
        status: "sent",
        createdAt: "2026-05-25T00:00:00.000Z",
      },
      {
        id: "user-displayable-image",
        conversationId: "conv-1",
        role: "user",
        kind: "image",
        content: "And this",
        imageUrl: "https://example.test/look.png",
        status: "sent",
        createdAt: "2026-05-25T00:00:01.000Z",
      },
    ]);
    renderWithQueryClient(<ChatView />);

    expect(await screen.findByText("Outfit image attached")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Open image preview" }),
    );
    expect(screen.getByRole("dialog", { name: "Image preview" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Image preview" })).toBeNull(),
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
      await screen.findByPlaceholderText("Ask Mochi..."),
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
