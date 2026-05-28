export type StyleIntent =
  | "fit-check"
  | "color-match"
  | "missing-piece"
  | "main-character";

export type ChatRole = "user" | "mochi" | "system";

export type MessageStatus = "sending" | "sent" | "failed";

export type LookVisibility = "private" | "public";

export interface UserProfile {
  id: string;
  handle: string;
  displayName: string;
  pronouns?: string;
  avatarUrl?: string;
  styleProfile: {
    vibe: string;
    favoriteColors: string[];
    avoidNotes: string[];
    sizesPrivate: boolean;
  };
  createdAt: string;
}

export interface MochiConversation {
  id: string;
  agentId: "mochi";
  title: string;
  lastMessage: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: ChatRole;
  kind: "text" | "image" | "analysis";
  content: string;
  imageUrl?: string;
  attachments?: ChatAttachment[];
  status: MessageStatus;
  createdAt: string;
}

export type ChatScenario =
  | "text_chat"
  | "image_review"
  | "ootd_review"
  | "live_voice"
  | "follow_up";

export interface ChatInputContext {
  source: "chat" | "camera" | "ootd" | "live";
  mode: "text" | "image" | "voice" | "multimodal";
  voice_transcript?: string;
  refers_to_media_id?: string;
  refers_to_ootd_report_id?: string;
  ootd_report_summary?: string;
}

export interface ChatAttachment {
  media_id: string;
  caption?: string;
  source: "chat" | "camera" | "ootd" | "live";
  role: "user";
  previewUrl?: string;
  fileName?: string;
  mimeType?: string;
}

export interface UploadedAttachment {
  media_id: string;
  url?: string;
  fileName?: string;
  mimeType?: string;
}

export interface SendMessageInput {
  content: string;
  imageUrl?: string;
  attachments?: ChatAttachment[];
  sessionId?: string;
  scenario?: ChatScenario;
  inputContext?: ChatInputContext;
  abortSignal?: AbortSignal;
  history?: ChatMessage[];
  onAssistantDelta?: (delta: string) => void;
}

export interface SendMessageResult {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}

export interface VisionAnalysis {
  id: string;
  intent: StyleIntent;
  title: string;
  summary: string;
  palette: string[];
  strengths: string[];
  suggestions: string[];
  mochiLine: string;
  createdAt: string;
}

export interface OotdReview {
  id: string;
  session_id: string;
  media_id: string;
  overall_judgement: string;
  style_label?: string;
  highlight: string;
  main_issue: string;
  suggestion: string;
  mochi_line: string;
  createdAt: string;
}

export interface OotdReport {
  id: string;
  mediaId: string;
  imageUrl: string;
  status: "completed" | "failed";
  todayJudgment: {
    title: string;
    score: number;
    label: string;
    summary: string;
  };
  overallStyle: string;
  highlights: string[];
  biggestIssue: string;
  suggestions: Array<{
    title: string;
    body: string;
  }>;
  palette: Array<{
    name: string;
    hex: string;
  }>;
  mochiLine: string;
  shareCard: {
    title: string;
    quote: string;
    advice: string[];
    cta: string;
  };
  createdAt: string;
}

export interface OotdShareCard {
  id: string;
  reportId: string;
  shortUrl: string;
  qrImageUrl: string;
  createdAt: string;
}

export interface LookCard {
  id: string;
  title: string;
  imageUrl?: string;
  visibility: LookVisibility;
  analysis: VisionAnalysis;
  tags: string[];
  createdAt: string;
}

export interface ShareLink {
  id: string;
  lookId: string;
  url: string;
  expiresAt?: string;
}
