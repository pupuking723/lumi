import type {
  ChatMessage,
  LookCard,
  MochiConversation,
  OotdReview,
  OotdReport,
  OotdShareCard,
  SendMessageInput,
  SendMessageResult,
  UploadedAttachment,
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

export interface SubmitOotdReviewInput {
  media_id: string;
  session_id: string;
  occasion?: string;
  note?: string;
}

export interface CreateOotdReportInput {
  media_id: string;
  session_id?: string;
  scene?: "daily" | "work" | "school" | "date" | "party" | "travel";
  note?: string;
  user_id?: string;
}

export interface LumiApiClient {
  getMe: () => Promise<UserProfile>;
  updateStyleProfile: (
    input: Partial<UserProfile["styleProfile"]>,
  ) => Promise<UserProfile>;
  listConversations: () => Promise<MochiConversation[]>;
  createConversation: () => Promise<MochiConversation>;
  deleteConversation: (conversationId: string) => Promise<void>;
  listMessages: (
    conversationId: string,
    sessionId?: string,
  ) => Promise<ChatMessage[]>;
  uploadAttachment: (file: File) => Promise<UploadedAttachment>;
  sendMessage: (
    conversationId: string,
    input: SendMessageInput,
  ) => Promise<SendMessageResult>;
  analyzeVision: (input: AnalyzeVisionInput) => Promise<VisionAnalysis>;
  submitOotdReview: (input: SubmitOotdReviewInput) => Promise<OotdReview>;
  createOotdReport: (input: CreateOotdReportInput) => Promise<OotdReport>;
  createOotdShareCard: (reportId: string) => Promise<OotdShareCard>;
  listLooks: () => Promise<LookCard[]>;
  createLook: (input: CreateLookInput) => Promise<LookCard>;
  createShareLink: (lookId: string) => Promise<ShareLink>;
}

export function createLumiApiClient(): LumiApiClient {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const chatProxyPath = process.env.NEXT_PUBLIC_LUMI_CHAT_PROXY_PATH;
  const messagesProxyPath = process.env.NEXT_PUBLIC_LUMI_MESSAGES_PROXY_PATH;
  const sessionsProxyPath = process.env.NEXT_PUBLIC_LUMI_SESSIONS_PROXY_PATH;
  const uploadProxyPath = process.env.NEXT_PUBLIC_LUMI_UPLOAD_PROXY_PATH;
  const ootdReportProxyPath = process.env.NEXT_PUBLIC_LUMI_OOTD_REPORT_PROXY_PATH;
  return baseUrl
    ? createHttpClient(baseUrl)
    : createMockClient({
        chatProxyPath:
          chatProxyPath === "off"
            ? undefined
            : (chatProxyPath ?? "/api/chat/completions"),
        messagesProxyPath:
          messagesProxyPath === "off"
            ? undefined
            : (messagesProxyPath ?? "/api/chat/messages"),
        sessionsProxyPath:
          sessionsProxyPath === "off"
            ? undefined
            : (sessionsProxyPath ?? "/api/chat/sessions"),
        uploadProxyPath:
          uploadProxyPath === "off"
            ? undefined
            : (uploadProxyPath ?? "/api/chat/attachments/upload"),
        ootdReportProxyPath:
          ootdReportProxyPath === "off"
            ? undefined
            : (ootdReportProxyPath ?? "/api/closy/ootd/reports"),
      });
}

export const apiClient = createLumiApiClient();
