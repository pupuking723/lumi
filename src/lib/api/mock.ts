import { demoAnalysis, seedLooks } from "@/lib/data/mochi";
import type {
  ChatMessage,
  LiveSession,
  LookCard,
  MochiConversation,
  ShareLink,
  UserProfile,
  VisionAnalysis,
} from "@/types/lumi";
import { sendMessageThroughChatProxy } from "./go-claw-chat";
import type { AnalyzeVisionInput, CreateLookInput, LumiApiClient } from "./client";

const delay = (ms = 420) => new Promise((resolve) => setTimeout(resolve, ms));
const id = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
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
        "Hi darling. I’m Mochi: cotton elf, color curator, and your tiny fashion witness. What are we making iconic today?",
      status: "sent",
      createdAt: now(),
    },
  ],
};

let looks: LookCard[] = [...seedLooks];

interface MockClientOptions {
  chatProxyPath?: string;
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

export function createMockClient(options: MockClientOptions = {}): LumiApiClient {
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
      await delay(180);
      return conversations;
    },
    async createConversation() {
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
    async listMessages(conversationId) {
      await delay(180);
      return messagesByConversation[conversationId] ?? [];
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
    async createLiveSession() {
      await delay(520);
      const session: LiveSession = {
        id: id("live"),
        agentId: "mochi",
        status: "connecting",
        startedAt: now(),
        realtimeToken: "mock-realtime-token",
      };
      return session;
    },
    async analyzeVision(input) {
      await delay(900);
      return buildAnalysis(input);
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
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
      };
      return link;
    },
  };
}
