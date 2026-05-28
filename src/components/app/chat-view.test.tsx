import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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
  createOotdReport: vi.fn(),
  createOotdShareCard: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  apiClient: apiMocks,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/chat",
}));

vi.mock("next-auth/react", () => ({
  useSession: authMocks.useSession,
  signIn: authMocks.signIn,
  signOut: authMocks.signOut,
}));

describe("ChatView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.useSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
    });
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
    apiMocks.createOotdReport.mockResolvedValue({
      id: "report-1",
      mediaId: "media-1",
      imageUrl: "",
      status: "completed",
      todayJudgment: {
        title: "City Casual Minimalism",
        score: 5.5,
        label: "Almost there",
        summary: "Clean base, but it needs one sharper anchor.",
      },
      overallStyle: "Relaxed city casual with neutral color weight.",
      highlights: ["The palette reads intentional."],
      biggestIssue: "The top half lands as one heavy block.",
      suggestions: [
        {
          title: "Add structure",
          body: "Use a clean bag, belt, or metal detail.",
        },
      ],
      palette: [{ name: "Black", hex: "#1A1A1A" }],
      mochiLine: "The base is fine; give it a backbone.",
      shareCard: {
        title: "City Casual Minimalism",
        quote: "The base is fine; give it a backbone.",
        advice: ["Add one structured detail."],
        cta: "Ask Mochi before you leave",
      },
      createdAt: "2026-05-25T00:00:00.000Z",
    });
    apiMocks.createOotdShareCard.mockResolvedValue({
      id: "share-1",
      reportId: "report-1",
      shortUrl: "https://lumi.style/ootd/report-1",
      qrImageUrl: "data:image/svg+xml,%3Csvg%3E%3C/svg%3E",
      createdAt: "2026-05-25T00:00:00.000Z",
    });
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
        inputContext: expect.objectContaining({ mode: "text" }),
      }),
    );
  });

  it("does not render structured OOTD JSON in the chat stream", async () => {
    apiMocks.sendMessage.mockImplementationOnce(
      async (_conversationId: string, input: SendMessageInput) => ({
        userMessage: {
          id: "user-json",
          conversationId: "conv-1",
          role: "user",
          kind: "text",
          content: input.content,
          status: "sent",
          createdAt: "2026-05-25T00:00:00.000Z",
        },
        assistantMessage: {
          id: "assistant-json",
          conversationId: "conv-1",
          role: "mochi",
          kind: "text",
          content: JSON.stringify({
            todayJudgment: {
              title: "电子包浆的执念",
              score: 2,
              label: "拒绝复读",
              summary: "这张图已经被你盘出电子包浆了。",
            },
            overallStyle: "赛博执念风",
            biggestIssue: "最大的问题是你拒绝面对现实。",
            suggestions: [
              {
                title: "换图",
                body: "拍一张真实的今日 OOTD。",
              },
            ],
            mochiLine: "光发壁纸可没法让你变辣。",
          }),
          status: "sent",
          createdAt: "2026-05-25T00:00:00.000Z",
        },
      }),
    );

    renderWithQueryClient(<ChatView />);

    const input = await screen.findByPlaceholderText("Ask Mochi...");
    fireEvent.change(input, { target: { value: "Can you review this look?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() =>
      expect(screen.queryByText(/todayJudgment/)).not.toBeInTheDocument(),
    );
    expect(screen.queryByText("电子包浆的执念")).not.toBeInTheDocument();
    expect(screen.queryByText("2.0/10")).not.toBeInTheDocument();
    expect(screen.queryByText("拍一张真实的今日 OOTD。")).not.toBeInTheDocument();
    expect(screen.queryByText(/todayJudgment/)).not.toBeInTheDocument();
  });

  it("hides partial streaming OOTD JSON instead of rendering it as a report", async () => {
    let finishSend!: () => void;
    const sendReady = new Promise<void>((resolve) => {
      finishSend = resolve;
    });
    const reportContent = JSON.stringify({
      todayJudgment: {
        title: "电影海报，非真实穿搭",
        score: 0,
        label: "无法诊断",
        summary: "这张是电影海报，不是今天的真实穿搭。",
      },
      overallStyle: "运动休闲风（海报人物）",
      biggestIssue: "图片不是日常穿搭照。",
      suggestions: [
        {
          title: "重新拍",
          body: "请发送一张清晰的全身穿搭照片。",
        },
      ],
      mochiLine: "电影里的衣服，也得你穿上身我才能点评。",
    });

    apiMocks.sendMessage.mockImplementationOnce(
      async (_conversationId: string, input: SendMessageInput) => {
        input.onAssistantDelta?.('{\n  "todayJudgment": {\n');
        await sendReady;
        return {
          userMessage: {
            id: "user-stream-json",
            conversationId: "conv-1",
            role: "user",
            kind: "text",
            content: input.content,
            status: "sent",
            createdAt: "2026-05-25T00:00:00.000Z",
          },
          assistantMessage: {
            id: "assistant-stream-json",
            conversationId: "conv-1",
            role: "mochi",
            kind: "text",
            content: reportContent,
            status: "sent",
            createdAt: "2026-05-25T00:00:00.000Z",
          },
        };
      },
    );

    renderWithQueryClient(<ChatView />);

    const input = await screen.findByPlaceholderText("Ask Mochi...");
    fireEvent.change(input, { target: { value: "Can you review this look?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() =>
      expect(screen.queryByText(/todayJudgment/)).not.toBeInTheDocument(),
    );
    expect(screen.queryByText("Preparing report…")).not.toBeInTheDocument();

    finishSend();

    await waitFor(() =>
      expect(screen.queryByText("电影海报，非真实穿搭")).not.toBeInTheDocument(),
    );
    expect(screen.queryByText(/todayJudgment/)).not.toBeInTheDocument();
  });

  it("hides fenced streaming OOTD JSON instead of rendering it as a report", async () => {
    let finishSend!: () => void;
    const sendReady = new Promise<void>((resolve) => {
      finishSend = resolve;
    });
    const reportContent = `\`\`\`json
${JSON.stringify({
  todayJudgment: {
    title: "职场精英范",
    score: 8,
    label: "利落专业",
    summary: "一套非常稳的通勤搭配。",
  },
  overallStyle: "商务休闲",
  biggestIssue: "白色高领略显厚重。",
  suggestions: [
    {
      title: "领口适当放松",
      body: "换成更轻薄的内搭。",
    },
  ],
  mochiLine: "稳是稳，但别把自己穿成会议室。",
})}
\`\`\``;

    apiMocks.sendMessage.mockImplementationOnce(
      async (_conversationId: string, input: SendMessageInput) => {
        input.onAssistantDelta?.('```json\n{\n  "todayJudgment": {\n');
        await sendReady;
        return {
          userMessage: {
            id: "user-stream-fenced-json",
            conversationId: "conv-1",
            role: "user",
            kind: "text",
            content: input.content,
            status: "sent",
            createdAt: "2026-05-25T00:00:00.000Z",
          },
          assistantMessage: {
            id: "assistant-stream-fenced-json",
            conversationId: "conv-1",
            role: "mochi",
            kind: "text",
            content: reportContent,
            status: "sent",
            createdAt: "2026-05-25T00:00:00.000Z",
          },
        };
      },
    );

    renderWithQueryClient(<ChatView />);

    const input = await screen.findByPlaceholderText("Ask Mochi...");
    fireEvent.change(input, { target: { value: "好好分析一下这个" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() =>
      expect(screen.queryByText(/todayJudgment/)).not.toBeInTheDocument(),
    );
    expect(screen.queryByText("Preparing report…")).not.toBeInTheDocument();

    finishSend();

    await waitFor(() =>
      expect(screen.queryByText("职场精英范")).not.toBeInTheDocument(),
    );
    expect(screen.queryByText(/todayJudgment/)).not.toBeInTheDocument();
  });

  it("answers image chat normally while generating the OOTD report in the background", async () => {
    const { container } = renderWithQueryClient(<ChatView />);
    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    await screen.findByPlaceholderText("Ask Mochi...");
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["image"], "look.png", { type: "image/png" })],
      },
    });
    expect(await screen.findByText("Ready for Mochi")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Ask Mochi..."), {
      target: { value: "Can you review this look?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() =>
      expect(screen.queryByText("Ready for Mochi")).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("dialog", { name: "OOTD report" })).toBeNull();
    expect(await screen.findByText("Mochi says yes.")).toBeInTheDocument();
    expect(apiMocks.createOotdReport).toHaveBeenCalledWith(
      expect.objectContaining({
        media_id: "media-1",
        scene: "daily",
        note: "Can you review this look?",
      }),
    );
    expect(screen.queryByText("City Casual Minimalism")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "OOTD report" }));

    const dialog = await screen.findByRole("dialog", { name: "OOTD report" });
    expect(
      within(dialog).getByText("City Casual Minimalism"),
    ).toBeInTheDocument();
  });

  it("does not mark the image message unsent when chat returns report JSON", async () => {
    apiMocks.sendMessage.mockRejectedValueOnce(
      new Error("Mochi returned a report instead of a chat reply. Please retry."),
    );

    const { container } = renderWithQueryClient(<ChatView />);
    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    await screen.findByPlaceholderText("Ask Mochi...");
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["image"], "look.png", { type: "image/png" })],
      },
    });
    expect(await screen.findByText("Ready for Mochi")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Ask Mochi..."), {
      target: { value: "这个穿搭适合什么" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("这个穿搭适合什么")).toBeInTheDocument();
    expect(await screen.findByText(/The thread snagged/)).toBeInTheDocument();
    expect(screen.queryByText(/not sent/i)).not.toBeInTheDocument();
    expect(apiMocks.createOotdReport).toHaveBeenCalledWith(
      expect.objectContaining({
        media_id: "media-1",
        note: "这个穿搭适合什么",
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

  it("keeps the OOTD button and modal in the same generating state", async () => {
    let finishReport!: (value: {
      id: string;
      mediaId: string;
      imageUrl: string;
      status: "completed";
      todayJudgment: {
        title: string;
        score: number;
        label: string;
        summary: string;
      };
      overallStyle: string;
      highlights: string[];
      biggestIssue: string;
      suggestions: Array<{ title: string; body: string }>;
      palette: Array<{ name: string; hex: string }>;
      mochiLine: string;
      shareCard: {
        title: string;
        quote: string;
        advice: string[];
        cta: string;
      };
      createdAt: string;
    }) => void;
    apiMocks.createOotdReport.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishReport = resolve;
        }),
    );

    const { container } = renderWithQueryClient(<ChatView />);
    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    await screen.findByPlaceholderText("Ask Mochi...");
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["image"], "look.png", { type: "image/png" })],
      },
    });
    expect(await screen.findByText("Ready for Mochi")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Ask Mochi..."), {
      target: { value: "Can you review this look?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() =>
      expect(screen.queryByText("Ready for Mochi")).not.toBeInTheDocument(),
    );
    const reportButton = await screen.findByRole("button", {
      name: "OOTD report",
    });
    await waitFor(() => expect(reportButton).toBeEnabled());
    fireEvent.click(reportButton);

    const dialog = await screen.findByRole("dialog", { name: "OOTD report" });
    expect(within(dialog).getByText(/Reading the outfit/i)).toBeInTheDocument();

    finishReport({
      id: "report-1",
      mediaId: "media-1",
      imageUrl: "",
      status: "completed",
      todayJudgment: {
        title: "City Casual Minimalism",
        score: 5.5,
        label: "Almost there",
        summary: "Clean base, but it needs one sharper anchor.",
      },
      overallStyle: "Relaxed city casual with neutral color weight.",
      highlights: ["The palette reads intentional."],
      biggestIssue: "The top half lands as one heavy block.",
      suggestions: [
        {
          title: "Add structure",
          body: "Use a clean bag, belt, or metal detail.",
        },
      ],
      palette: [{ name: "Black", hex: "#1A1A1A" }],
      mochiLine: "The base is fine; give it a backbone.",
      shareCard: {
        title: "City Casual Minimalism",
        quote: "The base is fine; give it a backbone.",
        advice: ["Add one structured detail."],
        cta: "Ask Mochi before you leave",
      },
      createdAt: "2026-05-25T00:00:00.000Z",
    });
    expect(
      await within(dialog).findByText("City Casual Minimalism"),
    ).toBeInTheDocument();
  });

  it("uploads, removes, and sends image attachments", async () => {
    const { container } = renderWithQueryClient(<ChatView />);
    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

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

  it("prompts users to sign in when image upload is unauthenticated", async () => {
    apiMocks.uploadAttachment.mockRejectedValueOnce(
      new ChatProxyError("Google sign-in is required.", 401),
    );

    const { container } = renderWithQueryClient(<ChatView />);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;

    await screen.findByPlaceholderText("Ask Mochi...");
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["image"], "look.png", { type: "image/png" })],
      },
    });

    expect(
      await screen.findByText("Sign in to send messages to Mochi."),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Sign in" }).length,
    ).toBeGreaterThan(1);
    expect(screen.queryByText("Upload failed")).not.toBeInTheDocument();
    expect(screen.queryByText("Uploading...")).not.toBeInTheDocument();
  });

  it("prompts users to sign in before starting live voice", async () => {
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia },
      configurable: true,
    });

    renderWithQueryClient(<ChatView />);

    await screen.findByPlaceholderText("Ask Mochi...");
    fireEvent.click(screen.getByRole("button", { name: "Start live voice chat" }));

    expect(
      await screen.findByText("Sign in to use live voice with Mochi."),
    ).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("creates an OOTD report from an uploaded image", async () => {
    const { container } = renderWithQueryClient(<ChatView />);
    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    await screen.findByPlaceholderText("Ask Mochi...");
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["image"], "look.png", { type: "image/png" })],
      },
    });

    fireEvent.click(await screen.findByRole("button", { name: "OOTD report" }));

    expect(await screen.findByText("City Casual Minimalism")).toBeInTheDocument();
    expect(apiMocks.createOotdReport).toHaveBeenCalledWith(
      expect.objectContaining({
        media_id: "media-1",
        scene: "daily",
      }),
    );
  });

  it("keeps the OOTD action on the sent image after the composer clears", async () => {
    const { container } = renderWithQueryClient(<ChatView />);
    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    await screen.findByPlaceholderText("Ask Mochi...");
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["image"], "look.png", { type: "image/png" })],
      },
    });

    fireEvent.click(await screen.findByRole("button", { name: "OOTD report" }));
    expect(await screen.findByText("City Casual Minimalism")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close OOTD report" }));

    fireEvent.change(screen.getByPlaceholderText("Ask Mochi..."), {
      target: { value: "What about this?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await screen.findByText("Mochi says yes.");
    await waitFor(() =>
      expect(screen.queryByText("Ready for Mochi")).not.toBeInTheDocument(),
    );

    const reportCallsBeforeReopen = apiMocks.createOotdReport.mock.calls.length;
    const reportButton = await screen.findByRole("button", {
      name: "OOTD report",
    });
    expect(reportButton).toBeInTheDocument();
    fireEvent.click(reportButton);

    expect(await screen.findByText("City Casual Minimalism")).toBeInTheDocument();
    expect(apiMocks.createOotdReport.mock.calls.length).toBe(
      reportCallsBeforeReopen,
    );
  });

  it("sends completed OOTD report context with follow-up chat turns", async () => {
    const { container } = renderWithQueryClient(<ChatView />);
    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    await screen.findByPlaceholderText("Ask Mochi...");
    fireEvent.change(fileInput, {
      target: {
        files: [new File(["image"], "look.png", { type: "image/png" })],
      },
    });
    expect(await screen.findByText("Ready for Mochi")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Ask Mochi..."), {
      target: { value: "Can you review this look?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(apiMocks.createOotdReport).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByText("Ready for Mochi")).not.toBeInTheDocument(),
    );

    fireEvent.change(screen.getByPlaceholderText("Ask Mochi..."), {
      target: { value: "What shoes should I change?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() =>
      expect(apiMocks.sendMessage).toHaveBeenLastCalledWith(
        "conv-1",
        expect.objectContaining({
          content: "What shoes should I change?",
          inputContext: expect.objectContaining({
            refers_to_ootd_report_id: "report-1",
            ootd_report_summary: expect.stringContaining(
              "City Casual Minimalism",
            ),
          }),
        }),
      ),
    );
  });

  it("sends image uploads directly to the live agent while voice is active", async () => {
    authMocks.useSession.mockReturnValue({
      data: {
        user: {
          name: "Wenyu Liu",
          email: "wenyu@example.com",
        },
      },
      status: "authenticated",
    });
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

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
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

    fireEvent.click(screen.getByRole("button", { name: "Open image preview" }));
    expect(screen.getByRole("dialog", { name: "Image preview" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Image preview" })).toBeNull(),
    );
  });

  it("shows retry after send failure and resends the last payload", async () => {
    apiMocks.sendMessage
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementationOnce(
        async (_conversationId: string, input: SendMessageInput) => ({
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
        }),
      );
    renderWithQueryClient(<ChatView />);

    fireEvent.change(await screen.findByPlaceholderText("Ask Mochi..."), {
      target: { value: "Help" },
    });
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
