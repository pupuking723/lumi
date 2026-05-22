export type StyleIntent =
  | "fit-check"
  | "color-match"
  | "missing-piece"
  | "main-character";

export type ChatRole = "user" | "mochi" | "system";

export type MessageStatus = "sending" | "sent" | "failed";

export type LiveSessionStatus =
  | "idle"
  | "permission"
  | "connecting"
  | "listening"
  | "responding"
  | "reconnecting"
  | "ended"
  | "error";

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
  status: MessageStatus;
  createdAt: string;
}

export interface SendMessageInput {
  content: string;
  imageUrl?: string;
  history?: ChatMessage[];
}

export interface SendMessageResult {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
}

export interface LiveSession {
  id: string;
  agentId: "mochi";
  status: LiveSessionStatus;
  startedAt: string;
  realtimeToken?: string;
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
