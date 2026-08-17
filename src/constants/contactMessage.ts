import { ChatMessageResponse, MessageReadReceipt } from "../types/chat.types";

/**
 * Centralized chat message payload structure.
 * Mirrors the shape emitted over Socket.IO and returned by REST APIs.
 */
export interface ContactMessagePayload {
  id: string;
  room_id: string;
  sender_id: string;
  content: string | null;
  created_at: Date | string;
  updated_at: Date | string | null;
  deleted_at: Date | string | null;
  is_delivered: boolean;
  delivered_at: Date | string | null;
  attachments?: ContactAttachment[];
  reads?: MessageReadReceipt[];
  sender?: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
  };
}

export interface ContactAttachment {
  id: string;
  file_name: string | null;
  mime_type: string | null;
  media_type: string | null;
  file_size: number | null;
  url: string;
}

export const buildContactMessage = (
  message: ChatMessageResponse
): ContactMessagePayload => ({
  id: message.id,
  room_id: message.room_id,
  sender_id: message.sender_id,
  content: message.content,
  created_at: message.created_at,
  updated_at: message.updated_at,
  deleted_at: message.deleted_at,
  is_delivered: message.is_delivered,
  delivered_at: message.delivered_at,
  attachments: message.attachments,
  reads: message.reads,
  sender: message.sender,
});

export const buildSendMessagePayload = (input: {
  roomId: string;
  content?: string;
  mediaIds?: string[];
}) => ({
  roomId: input.roomId,
  content: input.content,
  mediaIds: input.mediaIds,
});

export const buildEditMessagePayload = (input: {
  messageId: string;
  content: string;
}) => ({
  messageId: input.messageId,
  content: input.content,
});

export const buildDeleteMessagePayload = (messageId: string) => ({
  messageId,
});

export const buildTypingPayload = (roomId: string, userId: string) => ({
  roomId,
  userId,
});

export const buildMessageSeenPayload = (
  messageId: string,
  userId: string,
  readAt: Date | string
) => ({
  messageId,
  userId,
  read_at: readAt,
});

export const buildMessageDeliveredPayload = (
  messageId: string,
  deliveredAt: Date | string | null
) => ({
  messageId,
  delivered_at: deliveredAt,
});

export const buildRoomSeenPayload = (
  roomId: string,
  userId: string,
  readAt: Date | string
) => ({
  roomId,
  userId,
  read_at: readAt,
});

export const contactMessage = {
  build: buildContactMessage,
  send: buildSendMessagePayload,
  edit: buildEditMessagePayload,
  delete: buildDeleteMessagePayload,
  typing: buildTypingPayload,
  seen: buildMessageSeenPayload,
  delivered: buildMessageDeliveredPayload,
  roomSeen: buildRoomSeenPayload,
};
