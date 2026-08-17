import { Request, Response, NextFunction } from "express";

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthenticatedUser {
  id: string;
  userType?: string;
}

export interface ChatRequest extends Request {
  user?: AuthenticatedUser;
}

export type ChatControllerFn = (
  req: ChatRequest,
  res: Response,
  next: NextFunction
) => Promise<Response | void>;

// ─── Route Params ────────────────────────────────────────────────────────────

export interface RoomRouteParams {
  roomId: string;
}

export interface MessageRouteParams {
  messageId: string;
}

export interface ParticipantRouteParams extends RoomRouteParams {
  participantUserId: string;
}

// ─── Request Bodies ──────────────────────────────────────────────────────────

export interface SendMessageBody {
  roomId: string;
  content?: string;
  mediaIds?: string[];
}

export interface EditMessageBody {
  content: string;
}

export interface CreateRoomBody {
  recipientId?: string;
  name?: string;
  userIds?: string[];
}

export interface UpdateRoomBody {
  name?: string;
  groupImage?: string;
}

export interface AddParticipantsBody {
  userIds: string[];
}

export interface UploadFileBody {
  mediaType?: string;
}

// ─── DTOs (service layer) ────────────────────────────────────────────────────

export interface SendMessageDto {
  roomId: string;
  content?: string;
  mediaIds?: string[];
}

export interface EditMessageDto {
  messageId: string;
  content: string;
}

export interface CreateRoomDto {
  recipientId?: string;
  name?: string;
  userIds?: string[];
}

export interface UpdateRoomDto {
  name?: string;
  groupImage?: string;
}

// ─── Responses ───────────────────────────────────────────────────────────────

export interface MessageReadReceipt {
  user_id: string;
  read_at: Date | string;
}

export interface MediaAttachment {
  id: string;
  file_name: string | null;
  mime_type: string | null;
  media_type: string | null;
  file_size: number | null;
  url: string;
}

export interface ChatMessageResponse {
  id: string;
  room_id: string;
  sender_id: string;
  content: string | null;
  created_at: Date | string;
  updated_at: Date | string | null;
  deleted_at: Date | string | null;
  is_delivered: boolean;
  delivered_at: Date | string | null;
  attachments?: MediaAttachment[];
  reads?: MessageReadReceipt[];
  sender?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
  };
}

export interface ChatParticipantResponse {
  user_id: string;
  role: string;
  joined_at: Date | string;
  left_at?: Date | string | null;
  user?: ConnectedUser;
}

export interface ChatRoomResponse {
  id: string;
  name: string | null;
  group_image: string | null;
  is_group: boolean;
  created_at: Date | string;
  updated_at: Date | string | null;
  created_by: string | null;
  participants?: ChatParticipantResponse[];
  messages?: ChatMessageResponse[];
  unreadCount?: number;
}

export interface ConnectedUser {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  user_type?: string | null;
}

export interface PaginatedMessages {
  messages: ChatMessageResponse[];
  hasMore: boolean;
}

export interface UploadFileResult {
  mediaId: string;
  fileName: string;
  mimeType: string;
  mediaType: string;
  fileSize: number;
  url: string;
}

export interface PublicKeyRecord {
  user_id: string;
  public_key: string;
}

// ─── Database rows (repository) ────────────────────────────────────────────────

export interface ChatMessageRow {
  message_id: string;
  room_id: string;
  sender_id: string;
  content: string | null;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
  is_delivered: boolean | number;
  delivered_at: Date | null;
}

export interface ChatParticipantRow {
  participant_id: string;
  room_id: string;
  user_id: string;
  joined_at: Date;
  left_at: Date | null;
  role: string;
}

export interface ChatRoomRow {
  room_id: string;
  name: string | null;
  group_image: string | null;
  is_group: boolean | number;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
  created_by: string | null;
}

export interface MediaUploadRow {
  media_id: string;
  user_id: string | null;
  file_path: string;
  file_name: string | null;
  mime_type: string | null;
  media_type: string | null;
  file_size: number | null;
  created_at: Date;
}

export interface AppError extends Error {
  statusCode?: number;
}
