import * as crypto from "crypto";
import path from "path";
import { env } from "../config/env";
import { chatRepository } from "../repositories/chat.repository";
import { userService } from "./user.service";
import {
  ChatMessageResponse,
  ChatRoomResponse,
  CreateRoomDto,
  EditMessageDto,
  PaginatedMessages,
  SendMessageDto,
  UploadFileResult,
} from "../types/chat.types";

export class AppServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "AppServiceError";
    this.statusCode = statusCode;
  }
}

export class ChatService {
  private getEncryptionKey(): Buffer {
    return crypto
      .createHash("sha256")
      .update(env.encryptionSecret)
      .digest();
  }

  private encryptText(text: string): string {
    if (!text) return text;
    try {
      const iv = crypto.randomBytes(12);
      const key = this.getEncryptionKey();
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      let encrypted = cipher.update(text, "utf8", "hex");
      encrypted += cipher.final("hex");
      const tag = cipher.getAuthTag().toString("hex");
      return JSON.stringify({
        iv: iv.toString("hex"),
        tag,
        ciphertext: encrypted,
        isEncrypted: true,
      });
    } catch {
      return text;
    }
  }

  private decryptText(encryptedJson: string): string {
    if (!encryptedJson) return encryptedJson;
    try {
      const parsed = JSON.parse(encryptedJson) as {
        isEncrypted?: boolean;
        iv?: string;
        tag?: string;
        ciphertext?: string;
      };
      if (
        !parsed?.isEncrypted ||
        !parsed.iv ||
        !parsed.tag ||
        !parsed.ciphertext
      ) {
        return encryptedJson;
      }
      const iv = Buffer.from(parsed.iv, "hex");
      const tag = Buffer.from(parsed.tag, "hex");
      const key = this.getEncryptionKey();
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(parsed.ciphertext, "hex", "utf8");
      decrypted += decipher.final("utf8");
      return decrypted;
    } catch {
      return encryptedJson;
    }
  }

  async sendMessage(
    senderId: string,
    data: SendMessageDto
  ): Promise<ChatMessageResponse> {
    const isParticipant = await chatRepository.isRoomParticipant(
      data.roomId,
      senderId
    );
    if (!isParticipant) {
      throw new AppServiceError("You are not a participant in this room", 403);
    }

    const payload = { ...data };
    if (payload.content) {
      payload.content = this.encryptText(payload.content);
    }

    const message = await chatRepository.createMessage(senderId, payload);
    return this.resolveMessageUrls(message);
  }

  async editMessage(
    senderId: string,
    data: EditMessageDto
  ): Promise<ChatMessageResponse> {
    const existing = await chatRepository.getMessage(data.messageId);
    if (!existing || existing.sender_id !== senderId) {
      throw new AppServiceError("Message not found or you cannot edit it");
    }
    if (existing.deleted_at) {
      throw new AppServiceError("Cannot edit a deleted message");
    }

    const seenByOther = await chatRepository.hasBeenSeenByOther(
      data.messageId,
      senderId
    );
    if (seenByOther) {
      throw new AppServiceError(
        "Cannot edit a message after it has been seen"
      );
    }

    if (existing.is_delivered && existing.delivered_at) {
      const elapsedMs =
        Date.now() - new Date(existing.delivered_at).getTime();
      if (elapsedMs >= 15 * 60 * 1000) {
        throw new AppServiceError(
          "Cannot edit a message after 15 minutes of delivery"
        );
      }
    }

    const encryptedContent = this.encryptText(data.content);
    await chatRepository.updateMessage(senderId, {
      ...data,
      content: encryptedContent,
    });

    const message = await chatRepository.getMessage(data.messageId);
    if (!message) {
      throw new AppServiceError("Message not found", 404);
    }
    return this.resolveMessageUrls(message);
  }

  async deleteMessage(
    senderId: string,
    messageId: string
  ): Promise<ChatMessageResponse> {
    const existing = await chatRepository.getMessage(messageId);
    if (!existing || existing.sender_id !== senderId) {
      throw new AppServiceError("Message not found or you cannot delete it");
    }

    const row = await chatRepository.deleteMessage(senderId, messageId);
    return this.resolveMessageUrls({
      ...existing,
      deleted_at: row.deleted_at,
    });
  }

  async markMessageAsDelivered(messageId: string): Promise<ChatMessageResponse> {
    await chatRepository.updateDeliveryStatus(messageId, true);
    const message = await chatRepository.getMessage(messageId);
    if (!message) {
      throw new AppServiceError("Message not found", 404);
    }
    return this.resolveMessageUrls(message);
  }

  async markMessageAsSeen(messageId: string, userId: string) {
    const message = await chatRepository.getMessage(messageId);
    if (!message || message.sender_id === userId) {
      return null;
    }
    return chatRepository.createReadReceipt(messageId, userId);
  }

  async markRoomMessagesAsSeen(roomId: string, userId: string) {
    const isParticipant = await chatRepository.isRoomParticipant(
      roomId,
      userId
    );
    if (!isParticipant) {
      throw new AppServiceError(
        "You are not a participant in this room",
        403
      );
    }
    return chatRepository.markRoomMessagesAsSeen(roomId, userId);
  }

  async clearRoomHistory(roomId: string, userId: string): Promise<void> {
    const isParticipant = await chatRepository.isRoomParticipant(
      roomId,
      userId
    );
    if (!isParticipant) {
      throw new AppServiceError(
        "You are not a participant in this room",
        403
      );
    }
    await chatRepository.clearRoomHistory(roomId, userId);
  }

  async updateRoomDetails(
    roomId: string,
    data: { name?: string; groupImage?: string }
  ): Promise<ChatRoomResponse> {
    return chatRepository.updateRoom(roomId, data);
  }

  async isRoomParticipant(roomId: string, userId: string): Promise<boolean> {
    return chatRepository.isRoomParticipant(roomId, userId);
  }

  async isRoomAdmin(roomId: string, userId: string): Promise<boolean> {
    return chatRepository.isRoomAdmin(roomId, userId);
  }

  async getMessage(messageId: string): Promise<ChatMessageResponse | null> {
    const message = await chatRepository.getMessage(messageId);
    return message ? this.resolveMessageUrls(message) : null;
  }

  async registerPublicKey(userId: string, publicKey: string) {
    return chatRepository.registerPublicKey(userId, publicKey);
  }

  async getPublicKey(userId: string) {
    return chatRepository.getPublicKey(userId);
  }

  async getRoomPublicKeys(roomId: string) {
    return chatRepository.getRoomPublicKeys(roomId);
  }

  async getConversations(userId: string): Promise<ChatRoomResponse[]> {
    const rooms = await chatRepository.getConversations(userId);
    return Promise.all(
      rooms.map(async (room) => {
        if (room.messages && room.messages.length > 0) {
          room.messages[0] = await this.resolveMessageUrls(room.messages[0]);
        }
        return room;
      })
    );
  }

  async getMessages(
    roomId: string,
    userId: string,
    limit = 20,
    before?: string
  ): Promise<PaginatedMessages> {
    const isParticipant = await chatRepository.isRoomParticipant(
      roomId,
      userId
    );
    if (!isParticipant) {
      throw new AppServiceError(
        "You are not a participant in this room",
        403
      );
    }

    const { messages, hasMore } = await chatRepository.getMessages(
      roomId,
      userId,
      limit,
      before
    );
    const resolved = await Promise.all(
      messages.map((msg) => this.resolveMessageUrls(msg))
    );
    return { messages: resolved, hasMore };
  }

  async getOrCreateDirectRoom(
    userA: string,
    userB: string
  ): Promise<ChatRoomResponse> {
    const existing = await chatRepository.findDirectRoom(userA, userB);
    if (existing) {
      await chatRepository.activateRoomParticipants(existing.id, [userA, userB]);
      const room = await chatRepository.getRoom(existing.id);
      if (!room) {
        throw new AppServiceError("Room not found", 404);
      }
      return room;
    }
    return chatRepository.createRoom([userA, userB], undefined, false);
  }

  async createGroupRoom(
    userIds: string[],
    name: string,
    creatorId?: string
  ): Promise<ChatRoomResponse> {
    return chatRepository.createRoom(userIds, name, true, creatorId);
  }

  async createRoom(userId: string, data: CreateRoomDto): Promise<ChatRoomResponse> {
    if (data.name && data.userIds) {
      const allUserIds = Array.from(new Set([userId, ...data.userIds]));
      return this.createGroupRoom(allUserIds, data.name, userId);
    }
    if (data.recipientId) {
      return this.getOrCreateDirectRoom(userId, data.recipientId);
    }
    throw new AppServiceError("Invalid room creation payload");
  }

  async getConnectedUsers(
    userId: string,
    userType?: string
  ) {
    return userService.getConnectedUsers(userId, userType || "VOL");
  }

  async getRoomParticipants(roomId: string) {
    return chatRepository.getRoomParticipants(roomId);
  }

  async addRoomParticipants(roomId: string, userIds: string[]) {
    return chatRepository.addRoomParticipants(roomId, userIds);
  }

  async removeRoomParticipant(roomId: string, userId: string) {
    return chatRepository.removeRoomParticipant(roomId, userId);
  }

  async getLeftParticipants(roomId: string) {
    return chatRepository.getLeftParticipants(roomId);
  }

  async getRoom(roomId: string): Promise<ChatRoomResponse | null> {
    return chatRepository.getRoom(roomId);
  }

  async uploadFile(
    userId: string,
    file: { name: string; mimetype: string; size: number; mv: (path: string) => Promise<void> },
    mediaType: string
  ): Promise<UploadFileResult> {
    const ext = path.extname(file.name) || "";
    const storedName = `${crypto.randomUUID()}${ext}`;
    const relativePath = path.join(userId, storedName);
    const absolutePath = path.join(process.cwd(), "uploads", relativePath);

    await file.mv(absolutePath);

    const media = await chatRepository.createMediaUpload({
      userId,
      filePath: relativePath.replace(/\\/g, "/"),
      fileName: file.name,
      mimeType: file.mimetype,
      mediaType,
      fileSize: file.size,
    });

    const url = `${env.uploadBaseUrl}/${media.file_path}`;

    return {
      mediaId: media.media_id,
      fileName: media.file_name || file.name,
      mimeType: media.mime_type || file.mimetype,
      mediaType: media.media_type || mediaType,
      fileSize: media.file_size || file.size,
      url,
    };
  }

  async resolveMessageUrls(
    message: ChatMessageResponse
  ): Promise<ChatMessageResponse> {
    if (!message) return message;

    const decryptedContent = message.content
      ? this.decryptText(message.content)
      : message.content;

    if (!message.attachments || message.attachments.length === 0) {
      return { ...message, content: decryptedContent };
    }

    const attachments = message.attachments.map((item) => ({
      ...item,
      url: item.url || `${env.uploadBaseUrl}/${item.id}`,
    }));

    // Re-resolve from DB if url is empty
    for (const attachment of attachments) {
      if (!attachment.url || attachment.url.endsWith(attachment.id)) {
        const media = await chatRepository.getMediaById(attachment.id);
        if (media) {
          attachment.url = `${env.uploadBaseUrl}/${media.file_path}`;
        }
      }
    }

    return {
      ...message,
      content: decryptedContent,
      attachments,
    };
  }

  /** Strip ::reply:: / ::forwarded:: metadata for notification previews */
  formatChatNotificationBody(content?: string | null): string {
    if (!content) return "Sent an attachment";
    let text = String(content).trim();

    if (text.startsWith("::forwarded::")) {
      text = text.replace(/^::forwarded::/, "").trim();
    }

    if (text.includes("::reply::")) {
      const withNewline = text.match(
        /^::reply::([^:]+)::([^:]+)::([\s\S]*?)::\r?\n([\s\S]*)$/
      );
      if (withNewline) {
        text = (withNewline[4] || "").trim();
      } else {
        const parts = text.split("::");
        if (parts.length >= 6 && parts[1] === "reply") {
          text =
            parts.slice(5).join("::").replace(/^\r?\n/, "").trim() ||
            (parts[4] || "").trim();
        }
      }
    }

    text = text.replace(/\s+/g, " ").trim();
    if (!text) return "Sent an attachment";
    return text.length > 140 ? `${text.slice(0, 137)}...` : text;
  }
}

export const chatService = new ChatService();
