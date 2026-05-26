import type { ChatAttachment } from "@/types/lumi";

export type PendingAttachment = ChatAttachment & {
  localId: string;
  uploadStatus: "uploading" | "ready" | "failed";
  error?: string;
};
