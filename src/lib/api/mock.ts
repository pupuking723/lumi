import { demoAnalysis, seedLooks } from "@/lib/data/mochi";
import type {
  ChatMessage,
  LookCard,
  MochiConversation,
  OotdReport,
  OotdReview,
  OotdShareCard,
  ShareLink,
  UserProfile,
  VisionAnalysis,
} from "@/types/lumi";
import {
  createSessionThroughChatProxy,
  fetchMessagesThroughChatProxy,
  fetchSessionsThroughChatProxy,
  sendMessageThroughChatProxy,
} from "./go-claw-chat";
import type {
  AnalyzeVisionInput,
  CreateLookInput,
  CreateOotdReportInput,
  LumiApiClient,
} from "./client";

const delay = (ms = 420) => new Promise((resolve) => setTimeout(resolve, ms));
const id = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
const now = () => new Date().toISOString();

let userProfile: UserProfile = {
  id: "user-demo",
  handle: "softicon",
  displayName: "Lumi Girl",
  pronouns: "she/her",
  styleProfile: {
    vibe: "soft icon",
    favoriteColors: ["lilac", "cream", "emerald"],
    avoidNotes: ["body shaming", "diet talk", "mean-girl critique"],
    sizesPrivate: true,
  },
  createdAt: now(),
};

let conversations: MochiConversation[] = [
  {
    id: "conv-mochi-1",
    agentId: "mochi",
    title: "Today’s outfit thread",
    lastMessage: "Bring me the jacket and the tea. We can fix this.",
    updatedAt: now(),
  },
];

const messagesByConversation: Record<string, ChatMessage[]> = {
  "conv-mochi-1": [
    {
      id: "msg-welcome",
      conversationId: "conv-mochi-1",
      role: "mochi",
      kind: "text",
      content:
        "Hi, I’m Mochi. Send me the outfit, the occasion, or the tiny doubt before you leave. I’ll help with taste, proportion, color, and expression, then keep the final move wearable.",
      status: "sent",
      createdAt: now(),
    },
  ],
};

let looks: LookCard[] = [...seedLooks];

interface MockClientOptions {
  chatProxyPath?: string;
  messagesProxyPath?: string;
  sessionsProxyPath?: string;
  uploadProxyPath?: string;
  ootdReportProxyPath?: string;
}

function mochiReply(content: string): string {
  const lower = content.toLowerCase();
  if (lower.includes("color")) {
    return "Lilac with emerald is your anchor. Add cream if you want soft, gold if you want noticed. Both are allowed. I’m generous today.";
  }
  if (lower.includes("date") || lower.includes("coffee")) {
    return "Coffee date rule: one cozy texture, one sharp accessory. Soft knit, cat-eye frame, tiny hoop. Effortless, but with receipts.";
  }
  if (lower.includes("jacket")) {
    return "The jacket can stay if the shoe has weight. If the shoe is delicate, the jacket is doing too much theater.";
  }
  return "This has promise. Give me one color anchor, one texture moment, and one accessory that says you meant it.";
}

function buildAnalysis(input: AnalyzeVisionInput): VisionAnalysis {
  const label = {
    "fit-check": "Fit Check",
    "color-match": "Color Match",
    "missing-piece": "Missing Piece",
    "main-character": "Main Character",
  }[input.intent];

  return {
    ...demoAnalysis,
    id: id("analysis"),
    intent: input.intent,
    title: `${label}: ${input.imageName ? "Uploaded Look" : "Mirror Read"}`,
    summary:
      input.intent === "color-match"
        ? "The palette wants one confident anchor. Keep the base soft, then let emerald or denim do the talking."
        : demoAnalysis.summary,
    createdAt: now(),
  };
}

function buildOotdReview(input: {
  media_id: string;
  session_id: string;
  occasion?: string;
  note?: string;
}): OotdReview {
  return {
    id: id("ootd"),
    session_id: input.session_id,
    media_id: input.media_id,
    overall_judgement: "Wear it, but sharpen one detail.",
    style_label: input.occasion ?? "soft icon",
    highlight: "The palette already feels intentional and easy to read.",
    main_issue:
      "The look needs one cleaner anchor so the softness does not blur.",
    suggestion:
      input.note?.trim() ||
      "Add a sharper bag, glasses, or shoe shape to give the outfit a final point.",
    mochi_line: "Good mood. Great base. Give it one tiny wink of structure.",
    createdAt: now(),
  };
}

function buildOotdReport(input: CreateOotdReportInput): OotdReport {
  return {
    id: id("ootd-report"),
    mediaId: input.media_id,
    imageUrl: "",
    status: "completed",
    todayJudgment: {
      title: "City Casual Minimalism",
      score: 5.5,
      label: "Almost there",
      summary:
        "The palette is calm and wearable, but the upper half needs one clearer point of view.",
    },
    overallStyle:
      "Relaxed city casual built on neutrals, soft volume, and a low-key street base.",
    highlights: [
      "The black and bone colors already read intentional.",
      "Wide-leg trousers give the look an easy off-duty shape.",
    ],
    biggestIssue:
      "The black top sits as one heavy block, so the outfit loses a little personality before it reaches the accessories.",
    suggestions: [
      {
        title: "Add a sharper anchor",
        body: "Use a structured black bag, a clean belt, or a metal detail to make the relaxed base feel chosen.",
      },
      {
        title: "Lift the shoe story",
        body: "A lighter sneaker or a chunkier sole would connect the trousers to the rest of the outfit faster.",
      },
    ],
    palette: [
      { name: "Black", hex: "#1A1A1A" },
      { name: "Bone", hex: "#B8A99A" },
      { name: "Mist", hex: "#EAE9E1" },
    ],
    mochiLine: "The base is fine; it just needs one accessory with a backbone.",
    shareCard: {
      title: "City Casual Minimalism",
      quote: "The base is fine; it just needs one accessory with a backbone.",
      advice: ["Add one structured black detail.", "Let the shoes do more work."],
      cta: "Ask Mochi before you leave",
    },
    createdAt: now(),
  };
}

function buildOotdShareCard(reportId: string): OotdShareCard {
  const shortUrl = `https://lumi.style/ootd/${reportId}`;
  const qrSvg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="#fff"/><path fill="#302d43" d="M16 16h42v42H16zM102 16h42v42h-42zM16 102h42v42H16zM72 72h14v14H72zM94 72h14v14H94zM116 72h14v14h-14zM72 94h14v14H72zM102 102h14v14h-14zM130 102h14v14h-14zM72 124h14v20H72zM94 130h14v14H94zM122 130h22v14h-22z"/></svg>';
  return {
    id: id("share"),
    reportId,
    shortUrl,
    qrImageUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`,
    createdAt: now(),
  };
}

function rememberChatResult(
  conversationId: string,
  result: { userMessage: ChatMessage; assistantMessage: ChatMessage },
) {
  messagesByConversation[conversationId] = [
    ...(messagesByConversation[conversationId] ?? []),
    result.userMessage,
    result.assistantMessage,
  ];
  conversations = conversations.map((conversation) =>
    conversation.id === conversationId
      ? {
          ...conversation,
          lastMessage: result.assistantMessage.content,
          updatedAt: result.assistantMessage.createdAt,
        }
      : conversation,
  );
}

export function createMockClient(
  options: MockClientOptions = {},
): LumiApiClient {
  return {
    async getMe() {
      await delay(180);
      return userProfile;
    },
    async updateStyleProfile(input) {
      await delay(220);
      userProfile = {
        ...userProfile,
        styleProfile: {
          ...userProfile.styleProfile,
          ...input,
        },
      };
      return userProfile;
    },
    async listConversations() {
      if (options.sessionsProxyPath) {
        return fetchSessionsThroughChatProxy(options.sessionsProxyPath);
      }

      await delay(180);
      return conversations;
    },
    async createConversation() {
      if (options.sessionsProxyPath) {
        return createSessionThroughChatProxy(options.sessionsProxyPath);
      }

      await delay(240);
      const conversation: MochiConversation = {
        id: id("conv"),
        agentId: "mochi",
        title: "New styling thread",
        lastMessage: "New thread, fresh mirror.",
        updatedAt: now(),
      };
      conversations = [conversation, ...conversations];
      messagesByConversation[conversation.id] = [];
      return conversation;
    },
    async listMessages(conversationId, sessionId) {
      const resolvedSessionId = sessionId || conversationId;
      if (options.messagesProxyPath && resolvedSessionId) {
        return fetchMessagesThroughChatProxy(
          options.messagesProxyPath,
          conversationId,
          resolvedSessionId,
        );
      }

      await delay(180);
      return messagesByConversation[conversationId] ?? [];
    },
    async uploadAttachment(file) {
      if (options.uploadProxyPath) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(options.uploadProxyPath, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `Upload failed with ${response.status}`);
        }

        return response.json();
      }

      await delay(320);
      return {
        media_id: id("media"),
        fileName: file.name,
        mimeType: file.type,
      };
    },
    async sendMessage(conversationId, input) {
      if (options.chatProxyPath) {
        const result = await sendMessageThroughChatProxy(
          options.chatProxyPath,
          conversationId,
          input,
        );
        rememberChatResult(conversationId, result);
        return result;
      }

      await delay(760);
      const createdAt = now();
      const userMessage: ChatMessage = {
        id: id("msg-user"),
        conversationId,
        role: "user",
        kind: input.imageUrl ? "image" : "text",
        content: input.content || "Can you read this look?",
        imageUrl: input.imageUrl,
        attachments: input.attachments,
        status: "sent",
        createdAt,
      };
      const assistantMessage: ChatMessage = {
        id: id("msg-mochi"),
        conversationId,
        role: "mochi",
        kind: "text",
        content: mochiReply(input.content),
        status: "sent",
        createdAt: now(),
      };
      const result = { userMessage, assistantMessage };
      rememberChatResult(conversationId, result);
      return result;
    },
    async analyzeVision(input) {
      await delay(900);
      return buildAnalysis(input);
    },
    async submitOotdReview(input) {
      await delay(900);
      return buildOotdReview(input);
    },
    async createOotdReport(input) {
      if (options.ootdReportProxyPath) {
        const response = await fetch(options.ootdReportProxyPath, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            errorText || `OOTD report failed with ${response.status}`,
          );
        }

        return response.json();
      }

      await delay(1100);
      return buildOotdReport(input);
    },
    async createOotdShareCard(reportId) {
      if (options.ootdReportProxyPath) {
        const response = await fetch(
          `${options.ootdReportProxyPath}/${reportId}/share-card`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            errorText || `OOTD share card failed with ${response.status}`,
          );
        }

        return response.json();
      }

      await delay(420);
      return buildOotdShareCard(reportId);
    },
    async listLooks() {
      await delay(220);
      return looks;
    },
    async createLook(input: CreateLookInput) {
      await delay(360);
      const look: LookCard = {
        id: id("look"),
        title: input.title,
        imageUrl: input.imageUrl,
        visibility: input.visibility ?? "private",
        analysis: input.analysis,
        tags: input.analysis.palette,
        createdAt: now(),
      };
      looks = [look, ...looks];
      return look;
    },
    async createShareLink(lookId) {
      await delay(260);
      const link: ShareLink = {
        id: id("share"),
        lookId,
        url: `https://lumi.style/share/${lookId}`,
        expiresAt: new Date(
          Date.now() + 1000 * 60 * 60 * 24 * 14,
        ).toISOString(),
      };
      return link;
    },
  };
}
