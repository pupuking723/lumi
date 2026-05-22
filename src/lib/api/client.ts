import type {
  ChatMessage,
  LiveSession,
  LookCard,
  MochiConversation,
  SendMessageInput,
  SendMessageResult,
  UserProfile,
  VisionAnalysis,
  ShareLink,
  StyleIntent,
} from "@/types/lumi";
import { createHttpClient } from "./http";
import { createMockClient } from "./mock";

export interface AnalyzeVisionInput {
  intent: StyleIntent;
  imageName?: string;
  imageUrl?: string;
}

export interface CreateLookInput {
  title: string;
  imageUrl?: string;
  analysis: VisionAnalysis;
  visibility?: "private" | "public";
}

export interface LumiApiClient {
  getMe: () => Promise<UserProfile>;
  updateStyleProfile: (
    input: Partial<UserProfile["styleProfile"]>,
  ) => Promise<UserProfile>;
  listConversations: () => Promise<MochiConversation[]>;
  createConversation: () => Promise<MochiConversation>;
  listMessages: (conversationId: string) => Promise<ChatMessage[]>;
  sendMessage: (
    conversationId: string,
    input: SendMessageInput,
  ) => Promise<SendMessageResult>;
  createLiveSession: () => Promise<LiveSession>;
  analyzeVision: (input: AnalyzeVisionInput) => Promise<VisionAnalysis>;
  listLooks: () => Promise<LookCard[]>;
  createLook: (input: CreateLookInput) => Promise<LookCard>;
  createShareLink: (lookId: string) => Promise<ShareLink>;
}

export function createLumiApiClient(): LumiApiClient {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const chatProxyPath = process.env.NEXT_PUBLIC_LUMI_CHAT_PROXY_PATH;
  return baseUrl
    ? createHttpClient(baseUrl)
    : createMockClient({
        chatProxyPath:
          chatProxyPath === "off"
            ? undefined
            : (chatProxyPath ?? "/api/chat/completions"),
      });
}

export const apiClient = createLumiApiClient();
