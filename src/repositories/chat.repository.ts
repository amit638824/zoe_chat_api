import { randomUUID } from "crypto";
import { RowDataPacket } from "mysql2/promise";
import { query, execute, QueryParam } from "../config/database";
import {
  ChatMessageResponse,
  ChatParticipantResponse,
  ChatRoomResponse,
  EditMessageDto,
  MediaUploadRow,
  MessageReadReceipt,
  PaginatedMessages,
  PublicKeyRecord,
  SendMessageDto,
} from "../types/chat.types";

interface ChatMessageRow extends RowDataPacket {
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

interface ChatParticipantRow extends RowDataPacket {
  participant_id: string;
  room_id: string;
  user_id: string;
  joined_at: Date;
  left_at: Date | null;
  role: string;
}

interface ChatRoomRow extends RowDataPacket {
  room_id: string;
  name: string | null;
  group_image: string | null;
  is_group: boolean | number;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
  created_by: string | null;
}

interface MediaUploadDbRow extends RowDataPacket {
  media_id: string;
  user_id: string | null;
  file_path: string;
  file_name: string | null;
  mime_type: string | null;
  media_type: string | null;
  file_size: number | null;
  created_at: Date;
}

interface PublicKeyRow extends RowDataPacket {
  user_id: string;
  public_key: string;
}

interface MessageMediaJoin extends RowDataPacket {
  media_id: string;
  file_name: string | null;
  mime_type: string | null;
  media_type: string | null;
  file_size: number | null;
  file_path: string;
}

interface ReadJoin extends RowDataPacket {
  user_id: string;
  read_at: Date;
}

export class ChatRepository {
  async createMessage(
    senderId: string,
    data: SendMessageDto
  ): Promise<ChatMessageResponse> {
    const messageId = randomUUID();

    await execute(
      `INSERT INTO chat_messages (message_id, room_id, sender_id, content)
       VALUES (?, ?, ?, ?)`,
      [messageId, data.roomId, senderId, data.content || null]
    );

    if (data.mediaIds && data.mediaIds.length > 0) {
      for (const mediaId of data.mediaIds) {
        await execute(
          `INSERT INTO message_media (message_media_id, message_id, media_id)
           VALUES (?, ?, ?)`,
          [randomUUID(), messageId, mediaId]
        );
      }
    }

    const room = await this.getRoomBasic(data.roomId);
    if (room && !room.is_group) {
      await execute(
        `UPDATE chat_participants SET left_at = NULL WHERE room_id = ?`,
        [data.roomId]
      );
    }

    const message = await this.getMessage(messageId);
    if (!message) {
      throw new Error("Failed to create message");
    }
    return message;
  }

  async updateMessage(
    senderId: string,
    data: EditMessageDto
  ): Promise<ChatMessageRow> {
    await execute(
      `UPDATE chat_messages
       SET content = ?, updated_at = CURRENT_TIMESTAMP
       WHERE message_id = ? AND sender_id = ?`,
      [data.content, data.messageId, senderId]
    );

    const rows = await query<ChatMessageRow[]>(
      `SELECT * FROM chat_messages WHERE message_id = ?`,
      [data.messageId]
    );
    return rows[0];
  }

  async deleteMessage(
    senderId: string,
    messageId: string
  ): Promise<ChatMessageRow> {
    await execute(
      `UPDATE chat_messages SET deleted_at = CURRENT_TIMESTAMP
       WHERE message_id = ? AND sender_id = ?`,
      [messageId, senderId]
    );

    const rows = await query<ChatMessageRow[]>(
      `SELECT * FROM chat_messages WHERE message_id = ?`,
      [messageId]
    );
    return rows[0];
  }

  async getMessage(messageId: string): Promise<ChatMessageResponse | null> {
    const rows = await query<ChatMessageRow[]>(
      `SELECT * FROM chat_messages WHERE message_id = ?`,
      [messageId]
    );
    if (!rows[0]) return null;

    const media = await this.getMessageMedia(messageId);
    const reads = await this.getMessageReads(messageId);

    return this.mapMessage(rows[0], media, reads);
  }

  async updateDeliveryStatus(
    messageId: string,
    isDelivered: boolean
  ): Promise<ChatMessageRow> {
    await execute(
      `UPDATE chat_messages
       SET is_delivered = ?, delivered_at = ?
       WHERE message_id = ?`,
      [isDelivered ? 1 : 0, isDelivered ? new Date() : null, messageId]
    );

    const rows = await query<ChatMessageRow[]>(
      `SELECT * FROM chat_messages WHERE message_id = ?`,
      [messageId]
    );
    return rows[0];
  }

  async createReadReceipt(
    messageId: string,
    userId: string
  ): Promise<MessageReadReceipt & { id: string }> {
    const existing = await query<RowDataPacket[]>(
      `SELECT read_id, user_id, read_at FROM message_reads
       WHERE message_id = ? AND user_id = ?`,
      [messageId, userId]
    );

    if (existing[0]) {
      return {
        id: existing[0].read_id as string,
        user_id: existing[0].user_id as string,
        read_at: existing[0].read_at as Date,
      };
    }

    const readId = randomUUID();
    await execute(
      `INSERT INTO message_reads (read_id, message_id, user_id) VALUES (?, ?, ?)`,
      [readId, messageId, userId]
    );

    const rows = await query<ReadJoin[]>(
      `SELECT user_id, read_at FROM message_reads WHERE read_id = ?`,
      [readId]
    );

    return { id: readId, ...rows[0] };
  }

  async hasBeenSeenByOther(
    messageId: string,
    senderId: string
  ): Promise<boolean> {
    const rows = await query<RowDataPacket[]>(
      `SELECT read_id FROM message_reads
       WHERE message_id = ? AND user_id != ?
       LIMIT 1`,
      [messageId, senderId]
    );
    return rows.length > 0;
  }

  async registerPublicKey(
    userId: string,
    publicKey: string
  ): Promise<PublicKeyRecord> {
    const existing = await query<RowDataPacket[]>(
      `SELECT key_id FROM chat_public_keys WHERE user_id = ?`,
      [userId]
    );

    if (existing[0]) {
      await execute(
        `UPDATE chat_public_keys SET public_key = ?, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [publicKey, userId]
      );
    } else {
      await execute(
        `INSERT INTO chat_public_keys (key_id, user_id, public_key) VALUES (?, ?, ?)`,
        [randomUUID(), userId, publicKey]
      );
    }

    const rows = await query<PublicKeyRow[]>(
      `SELECT user_id, public_key FROM chat_public_keys WHERE user_id = ?`,
      [userId]
    );
    return rows[0];
  }

  async getPublicKey(userId: string): Promise<PublicKeyRecord | null> {
    const rows = await query<PublicKeyRow[]>(
      `SELECT user_id, public_key FROM chat_public_keys WHERE user_id = ?`,
      [userId]
    );
    return rows[0] || null;
  }

  async getRoomPublicKeys(
    roomId: string
  ): Promise<Array<{ userId: string; publicKey: string | null }>> {
    const room = await this.getRoomBasic(roomId);
    const isGroup = room?.is_group ?? false;

    const sql = isGroup
      ? `SELECT cp.user_id, cpk.public_key
         FROM chat_participants cp
         LEFT JOIN chat_public_keys cpk ON cpk.user_id = cp.user_id
         WHERE cp.room_id = ? AND cp.left_at IS NULL`
      : `SELECT cp.user_id, cpk.public_key
         FROM chat_participants cp
         LEFT JOIN chat_public_keys cpk ON cpk.user_id = cp.user_id
         WHERE cp.room_id = ?`;

    const rows = await query<RowDataPacket[]>(sql, [roomId]);

    return rows.map((row) => ({
      userId: row.user_id as string,
      publicKey: (row.public_key as string) || null,
    }));
  }

  async getConversations(userId: string): Promise<ChatRoomResponse[]> {
    interface ConversationRow extends RowDataPacket {
      participant_id: string;
      room_id: string;
      user_id: string;
      joined_at: Date;
      left_at: Date | null;
      role: string;
      name: string | null;
      group_image: string | null;
      is_group: boolean | number;
      room_created_at: Date;
      room_updated_at: Date | null;
      created_by: string | null;
    }

    const participantRows = await query<ConversationRow[]>(
      `SELECT cp.participant_id, cp.room_id, cp.user_id, cp.joined_at, cp.left_at, cp.role,
              cr.name, cr.group_image, cr.is_group, cr.created_at AS room_created_at,
              cr.updated_at AS room_updated_at, cr.created_by
       FROM chat_participants cp
       INNER JOIN chat_rooms cr ON cr.room_id = cp.room_id
       WHERE cp.user_id = ? AND cp.left_at IS NULL AND cr.deleted_at IS NULL`,
      [userId]
    );

    const rooms: ChatRoomResponse[] = [];

    for (const pr of participantRows) {
      const roomId = pr.room_id;
      const joinedAt = pr.joined_at;

      const unreadRows = await query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM chat_messages cm
         WHERE cm.room_id = ?
           AND cm.sender_id != ?
           AND cm.deleted_at IS NULL
           AND cm.created_at >= ?
           AND NOT EXISTS (
             SELECT 1 FROM message_reads mr
             WHERE mr.message_id = cm.message_id AND mr.user_id = ?
           )`,
        [roomId, userId, joinedAt, userId]
      );

      const lastMessages = await this.getMessages(
        roomId,
        userId,
        1,
        undefined
      );

      const participants = await this.getRoomParticipants(roomId);
      const isGroup = Boolean(pr.is_group);

      const filteredParticipants = isGroup
        ? participants.filter(
            (p) => !p.left_at && p.user_id !== userId
          )
        : participants.filter((p) => p.user_id !== userId);

      rooms.push({
        id: roomId,
        name: pr.name,
        group_image: pr.group_image,
        is_group: isGroup,
        created_at: pr.room_created_at || pr.joined_at,
        updated_at: pr.room_updated_at,
        created_by: pr.created_by,
        participants: filteredParticipants,
        messages: lastMessages.messages,
        unreadCount: Number(unreadRows[0]?.cnt || 0),
      });
    }

    return rooms.sort((a, b) => {
      const aTime =
        a.messages?.[0]?.created_at || a.updated_at || a.created_at || 0;
      const bTime =
        b.messages?.[0]?.created_at || b.updated_at || b.created_at || 0;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }

  async getMessages(
    roomId: string,
    userId: string,
    limit = 20,
    before?: string
  ): Promise<PaginatedMessages> {
    const participantRows = await query<RowDataPacket[]>(
      `SELECT joined_at FROM chat_participants
       WHERE room_id = ? AND user_id = ? LIMIT 1`,
      [roomId, userId]
    );

    const minDate = participantRows[0]?.joined_at || new Date(0);
    const take = Math.min(Math.max(limit, 1), 50) + 1;

    let sql = `SELECT * FROM chat_messages
               WHERE room_id = ? AND deleted_at IS NULL AND created_at >= ?`;
    const params: QueryParam[] = [roomId, minDate];

    if (before) {
      const beforeDate = new Date(before);
      if (!Number.isNaN(beforeDate.getTime())) {
        sql += ` AND created_at < ?`;
        params.push(beforeDate);
      }
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(take);

    const rows = await query<ChatMessageRow[]>(sql, params);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const messages: ChatMessageResponse[] = [];
    for (const row of page.reverse()) {
      const media = await this.getMessageMedia(row.message_id);
      const reads = await this.getMessageReads(row.message_id);
      messages.push(this.mapMessage(row, media, reads));
    }

    return { messages, hasMore };
  }

  async createRoom(
    userIds: string[],
    name?: string,
    isGroup = false,
    creatorId?: string
  ): Promise<ChatRoomResponse> {
    const roomId = randomUUID();

    await execute(
      `INSERT INTO chat_rooms (room_id, name, is_group, created_by)
       VALUES (?, ?, ?, ?)`,
      [roomId, name || null, isGroup ? 1 : 0, creatorId || null]
    );

    for (const userId of userIds) {
      await execute(
        `INSERT INTO chat_participants (participant_id, room_id, user_id, role)
         VALUES (?, ?, ?, ?)`,
        [
          randomUUID(),
          roomId,
          userId,
          userId === creatorId ? "ADMIN" : "MEMBER",
        ]
      );
    }

    const room = await this.getRoom(roomId);
    if (!room) {
      throw new Error("Failed to create room");
    }
    return room;
  }

  async findDirectRoom(
    userA: string,
    userB: string
  ): Promise<ChatRoomResponse | null> {
    const rooms = await query<ChatRoomRow[]>(
      `SELECT cr.* FROM chat_rooms cr
       INNER JOIN chat_participants cp ON cp.room_id = cr.room_id
       WHERE cr.is_group = 0 AND cr.deleted_at IS NULL AND cp.user_id = ?`,
      [userA]
    );

    for (const room of rooms) {
      const participants = await query<ChatParticipantRow[]>(
        `SELECT * FROM chat_participants WHERE room_id = ?`,
        [room.room_id]
      );
      const pIds = participants.map((p) => p.user_id);
      if (pIds.length === 2 && pIds.includes(userB)) {
        return this.getRoom(room.room_id);
      }
    }

    return null;
  }

  async getRoomParticipants(
    roomId: string
  ): Promise<ChatParticipantResponse[]> {
    const rows = await query<ChatParticipantRow[]>(
      `SELECT * FROM chat_participants
       WHERE room_id = ? AND left_at IS NULL`,
      [roomId]
    );

    return rows.map((row) => ({
      user_id: row.user_id,
      role: row.role,
      joined_at: row.joined_at,
      left_at: row.left_at,
    }));
  }

  async markRoomMessagesAsSeen(
    roomId: string,
    userId: string
  ): Promise<Array<MessageReadReceipt & { id: string }>> {
    const unread = await query<RowDataPacket[]>(
      `SELECT cm.message_id FROM chat_messages cm
       WHERE cm.room_id = ?
         AND cm.sender_id != ?
         AND cm.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM message_reads mr
           WHERE mr.message_id = cm.message_id AND mr.user_id = ?
         )`,
      [roomId, userId, userId]
    );

    if (unread.length === 0) return [];

    const ids = unread.map((r) => r.message_id as string);

    await execute(
      `UPDATE chat_messages SET is_delivered = 1, delivered_at = CURRENT_TIMESTAMP
       WHERE message_id IN (${ids.map(() => "?").join(",")}) AND is_delivered = 0`,
      ids
    );

    const receipts: Array<MessageReadReceipt & { id: string }> = [];
    for (const row of unread) {
      try {
        const receipt = await this.createReadReceipt(
          row.message_id as string,
          userId
        );
        receipts.push(receipt);
      } catch {
        // duplicate read receipt ignored
      }
    }

    return receipts;
  }

  async clearRoomHistory(roomId: string, userId: string): Promise<void> {
    const room = await this.getRoomBasic(roomId);
    const isGroup = room?.is_group ?? false;

    await execute(
      `UPDATE chat_participants
       SET joined_at = CURRENT_TIMESTAMP, left_at = ?
       WHERE room_id = ? AND user_id = ?`,
      [isGroup ? null : new Date(), roomId, userId]
    );
  }

  async updateRoom(
    roomId: string,
    data: { name?: string; groupImage?: string }
  ): Promise<ChatRoomResponse> {
    const fields: string[] = ["updated_at = CURRENT_TIMESTAMP"];
    const params: QueryParam[] = [];

    if (data.name !== undefined) {
      fields.push("name = ?");
      params.push(data.name);
    }
    if (data.groupImage !== undefined) {
      fields.push("group_image = ?");
      params.push(data.groupImage);
    }

    params.push(roomId);
    await execute(
      `UPDATE chat_rooms SET ${fields.join(", ")} WHERE room_id = ?`,
      params
    );

    const room = await this.getRoom(roomId);
    if (!room) {
      throw new Error("Room not found");
    }
    return room;
  }

  async getRoom(roomId: string): Promise<ChatRoomResponse | null> {
    const rows = await query<ChatRoomRow[]>(
      `SELECT * FROM chat_rooms WHERE room_id = ? AND deleted_at IS NULL`,
      [roomId]
    );
    if (!rows[0]) return null;

    let participants = await this.getRoomParticipants(roomId);
    if (rows[0].is_group) {
      participants = participants.filter((p) => !p.left_at);
    }

    return {
      id: rows[0].room_id,
      name: rows[0].name,
      group_image: rows[0].group_image,
      is_group: Boolean(rows[0].is_group),
      created_at: rows[0].created_at,
      updated_at: rows[0].updated_at,
      created_by: rows[0].created_by,
      participants,
    };
  }

  async addRoomParticipants(
    roomId: string,
    userIds: string[]
  ): Promise<ChatRoomResponse> {
    const existing = await query<ChatParticipantRow[]>(
      `SELECT * FROM chat_participants
       WHERE room_id = ? AND user_id IN (${userIds.map(() => "?").join(",")})`,
      [roomId, ...userIds]
    );

    const existingUserIds = existing.map((p) => p.user_id);
    const newUserIds = userIds.filter((id) => !existingUserIds.includes(id));

    for (const userId of newUserIds) {
      await execute(
        `INSERT INTO chat_participants (participant_id, room_id, user_id, role)
         VALUES (?, ?, ?, 'MEMBER')`,
        [randomUUID(), roomId, userId]
      );
    }

    if (existingUserIds.length > 0) {
      await execute(
        `UPDATE chat_participants
         SET left_at = NULL, role = 'MEMBER', joined_at = CURRENT_TIMESTAMP
         WHERE room_id = ? AND user_id IN (${existingUserIds.map(() => "?").join(",")})`,
        [roomId, ...existingUserIds]
      );
    }

    const room = await this.getRoom(roomId);
    if (!room) {
      throw new Error("Room not found");
    }
    return room;
  }

  async removeRoomParticipant(
    roomId: string,
    userId: string
  ): Promise<ChatRoomResponse> {
    await execute(
      `UPDATE chat_participants SET left_at = CURRENT_TIMESTAMP
       WHERE room_id = ? AND user_id = ? AND left_at IS NULL`,
      [roomId, userId]
    );

    const room = await this.getRoom(roomId);
    if (!room) {
      throw new Error("Room not found");
    }
    return room;
  }

  async getLeftParticipants(roomId: string): Promise<ChatParticipantResponse[]> {
    const rows = await query<ChatParticipantRow[]>(
      `SELECT * FROM chat_participants
       WHERE room_id = ? AND left_at IS NOT NULL`,
      [roomId]
    );

    return rows.map((row) => ({
      user_id: row.user_id,
      role: row.role,
      joined_at: row.joined_at,
      left_at: row.left_at,
    }));
  }

  async activateRoomParticipants(
    roomId: string,
    userIds: string[]
  ): Promise<void> {
    if (userIds.length === 0) return;
    await execute(
      `UPDATE chat_participants SET left_at = NULL
       WHERE room_id = ? AND user_id IN (${userIds.map(() => "?").join(",")})`,
      [roomId, ...userIds]
    );
  }

  async isRoomParticipant(roomId: string, userId: string): Promise<boolean> {
    const rows = await query<RowDataPacket[]>(
      `SELECT participant_id FROM chat_participants
       WHERE room_id = ? AND user_id = ? AND left_at IS NULL LIMIT 1`,
      [roomId, userId]
    );
    return rows.length > 0;
  }

  async isRoomAdmin(roomId: string, userId: string): Promise<boolean> {
    const room = await this.getRoomBasic(roomId);
    if (!room) return false;
    if (room.created_by === userId) return true;

    const rows = await query<ChatParticipantRow[]>(
      `SELECT role FROM chat_participants
       WHERE room_id = ? AND user_id = ? AND left_at IS NULL LIMIT 1`,
      [roomId, userId]
    );
    return rows[0]?.role === "ADMIN";
  }

  async createMediaUpload(data: {
    userId: string;
    filePath: string;
    fileName: string;
    mimeType: string;
    mediaType: string;
    fileSize: number;
  }): Promise<MediaUploadRow> {
    const mediaId = randomUUID();
    await execute(
      `INSERT INTO media_uploads
       (media_id, user_id, file_path, file_name, mime_type, media_type, file_size)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        mediaId,
        data.userId,
        data.filePath,
        data.fileName,
        data.mimeType,
        data.mediaType,
        data.fileSize,
      ]
    );

    const rows = await query<MediaUploadDbRow[]>(
      `SELECT * FROM media_uploads WHERE media_id = ?`,
      [mediaId]
    );
    return rows[0] as unknown as MediaUploadRow;
  }

  async getMediaById(mediaId: string): Promise<MediaUploadRow | null> {
    const rows = await query<MediaUploadDbRow[]>(
      `SELECT * FROM media_uploads WHERE media_id = ? AND deleted_at IS NULL`,
      [mediaId]
    );
    return (rows[0] as unknown as MediaUploadRow) || null;
  }

  private async getRoomBasic(roomId: string): Promise<ChatRoomRow | null> {
    const rows = await query<ChatRoomRow[]>(
      `SELECT * FROM chat_rooms WHERE room_id = ?`,
      [roomId]
    );
    return rows[0] || null;
  }

  private async getMessageMedia(messageId: string): Promise<MessageMediaJoin[]> {
    return query<MessageMediaJoin[]>(
      `SELECT mu.media_id, mu.file_name, mu.mime_type, mu.media_type,
              mu.file_size, mu.file_path
       FROM message_media mm
       INNER JOIN media_uploads mu ON mu.media_id = mm.media_id
       WHERE mm.message_id = ? AND mu.deleted_at IS NULL`,
      [messageId]
    );
  }

  private async getMessageReads(messageId: string): Promise<ReadJoin[]> {
    return query<ReadJoin[]>(
      `SELECT user_id, read_at FROM message_reads WHERE message_id = ?`,
      [messageId]
    );
  }

  private mapMessage(
    row: ChatMessageRow,
    media: MessageMediaJoin[],
    reads: ReadJoin[]
  ): ChatMessageResponse {
    return {
      id: row.message_id,
      room_id: row.room_id,
      sender_id: row.sender_id,
      content: row.content,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
      is_delivered: Boolean(row.is_delivered),
      delivered_at: row.delivered_at,
      attachments: media.map((m) => ({
        id: m.media_id,
        file_name: m.file_name,
        mime_type: m.mime_type,
        media_type: m.media_type,
        file_size: m.file_size,
        url: "",
      })),
      reads: reads.map((r) => ({
        user_id: r.user_id,
        read_at: r.read_at,
      })),
    };
  }
}

export const chatRepository = new ChatRepository();
