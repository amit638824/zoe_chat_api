import { Server as SocketServer } from "socket.io";
import { Socket } from "socket.io";
import { chatService } from "../services/chat.service";
import { presenceService } from "../services/presence.service";
import { SOCKET_EVENTS, getRoomChannel } from "../constants/events";
import { contactMessage } from "../constants/contactMessage";
import {
  validateCreateRoom,
  validateDeleteMessage,
  validateEditMessage,
  validateSendMessage,
  validateTyping,
} from "../validations/chat.validation";
import { ChatRoomResponse } from "../types/chat.types";

interface AuthenticatedSocket extends Socket {
  data: {
    userId?: string;
    userType?: string;
  };
}

export class ChatSocketHandler {
  private io: SocketServer | null = null;

  init(io: SocketServer): void {
    this.io = io;

    io.use((socket: AuthenticatedSocket, next) => {
      const userId =
        socket.handshake.auth?.userId ||
        (socket.handshake.headers["x-user-id"] as string) ||
        (socket.handshake.query.userId as string);

      if (!userId) {
        return next(new Error("Unauthorized: userId required in auth"));
      }

      socket.data.userId = userId;
      socket.data.userType =
        socket.handshake.auth?.userType ||
        (socket.handshake.headers["x-user-type"] as string) ||
        (socket.handshake.query.userType as string) ||
        "VOL";

      next();
    });

    io.on(SOCKET_EVENTS.CONNECT, (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });
  }

  private handleConnection(socket: AuthenticatedSocket): void {
    const userId = socket.data.userId!;
    const isFirst = presenceService.registerConnection(userId, socket.id);

    socket.emit(
      SOCKET_EVENTS.GET_ONLINE_USERS,
      presenceService.getOnlineUsers()
    );

    if (isFirst) {
      socket.broadcast.emit(SOCKET_EVENTS.USER_ONLINE, { userId });
    }

    this.registerEventHandlers(socket);

    socket.on(SOCKET_EVENTS.DISCONNECT, () => {
      const wasLast = presenceService.deregisterConnection(userId, socket.id);
      if (wasLast) {
        socket.broadcast.emit(SOCKET_EVENTS.USER_OFFLINE, { userId });
      }
    });
  }

  private registerEventHandlers(socket: AuthenticatedSocket): void {
    const userId = socket.data.userId!;

    socket.on(SOCKET_EVENTS.JOIN_CHAT, async (roomId: string, ack?) => {
      try {
        const hasAccess = await chatService.isRoomParticipant(roomId, userId);
        if (!hasAccess) {
          ack?.({ error: "Unauthorized access to this chat room" });
          return;
        }
        await socket.join(getRoomChannel(roomId));
        ack?.({ roomId, status: "joined" });
      } catch (err) {
        ack?.({ error: (err as Error).message });
      }
    });

    socket.on(SOCKET_EVENTS.LEAVE_CHAT, async (roomId: string, ack?) => {
      await socket.leave(getRoomChannel(roomId));
      ack?.({ roomId, status: "left" });
    });

    socket.on(SOCKET_EVENTS.SEND_MESSAGE, async (data: unknown, ack?) => {
      try {
        const payload = validateSendMessage(data);
        const message = await chatService.sendMessage(userId, payload);
        const built = contactMessage.build(message);

        await this.joinParticipantsToRoom(payload.roomId);
        this.emitToRoom(
          getRoomChannel(payload.roomId),
          SOCKET_EVENTS.RECEIVE_MESSAGE,
          built
        );
        ack?.(built);
      } catch (err) {
        ack?.({ error: (err as Error).message });
      }
    });

    socket.on(SOCKET_EVENTS.EDIT_MESSAGE, async (data: unknown, ack?) => {
      try {
        const payload = validateEditMessage(data);
        const message = await chatService.editMessage(userId, payload);
        const built = contactMessage.build(message);

        this.emitToRoom(
          getRoomChannel(message.room_id),
          SOCKET_EVENTS.MESSAGE_EDITED,
          built
        );
        ack?.(built);
      } catch (err) {
        ack?.({ error: (err as Error).message });
      }
    });

    socket.on(SOCKET_EVENTS.DELETE_MESSAGE, async (data: unknown, ack?) => {
      try {
        const messageId = validateDeleteMessage(data);
        const message = await chatService.deleteMessage(userId, messageId);

        this.emitToRoom(
          getRoomChannel(message.room_id),
          SOCKET_EVENTS.MESSAGE_DELETED,
          { messageId }
        );
        ack?.({ messageId, status: "deleted" });
      } catch (err) {
        ack?.({ error: (err as Error).message });
      }
    });

    socket.on(
      SOCKET_EVENTS.MESSAGE_SEEN,
      async (messageId: string) => {
        const readReceipt = await chatService.markMessageAsSeen(
          messageId,
          userId
        );
        if (!readReceipt) return;

        const message = await chatService.getMessage(messageId);
        if (message) {
          this.emitToRoom(
            getRoomChannel(message.room_id),
            SOCKET_EVENTS.MESSAGE_SEEN,
            contactMessage.seen(messageId, userId, readReceipt.read_at)
          );
        }
      }
    );

    socket.on(
      SOCKET_EVENTS.MESSAGE_DELIVERED,
      async (messageId: string) => {
        if (!messageId) return;
        const existing = await chatService.getMessage(messageId);
        if (!existing || existing.sender_id === userId) return;

        if (existing.is_delivered) {
          this.emitToRoom(
            getRoomChannel(existing.room_id),
            SOCKET_EVENTS.MESSAGE_DELIVERED,
            contactMessage.delivered(messageId, existing.delivered_at)
          );
          return;
        }

        const message = await chatService.markMessageAsDelivered(messageId);
        this.emitToRoom(
          getRoomChannel(message.room_id),
          SOCKET_EVENTS.MESSAGE_DELIVERED,
          contactMessage.delivered(messageId, message.delivered_at)
        );
      }
    );

    socket.on(SOCKET_EVENTS.START_TYPING, (data: unknown) => {
      try {
        const roomId = validateTyping(data);
        socket.to(getRoomChannel(roomId)).emit(
          SOCKET_EVENTS.START_TYPING,
          contactMessage.typing(roomId, userId)
        );
      } catch {
        // ignore invalid typing payload
      }
    });

    socket.on(SOCKET_EVENTS.STOP_TYPING, (data: unknown) => {
      try {
        const roomId = validateTyping(data);
        socket.to(getRoomChannel(roomId)).emit(
          SOCKET_EVENTS.STOP_TYPING,
          contactMessage.typing(roomId, userId)
        );
      } catch {
        // ignore invalid typing payload
      }
    });

    socket.on(
      SOCKET_EVENTS.REGISTER_PUBLIC_KEY,
      async (publicKey: string, ack?) => {
        try {
          const result = await chatService.registerPublicKey(userId, publicKey);
          ack?.(result);
        } catch (err) {
          ack?.({ error: (err as Error).message });
        }
      }
    );

    socket.on(
      SOCKET_EVENTS.GET_USER_PUBLIC_KEY,
      async (targetUserId: string, ack?) => {
        const result = await chatService.getPublicKey(targetUserId);
        ack?.(result);
      }
    );

    socket.on(
      SOCKET_EVENTS.GET_ROOM_PUBLIC_KEYS,
      async (roomId: string, ack?) => {
        const result = await chatService.getRoomPublicKeys(roomId);
        ack?.(result);
      }
    );

    socket.on(SOCKET_EVENTS.GET_CONVERSATIONS, async (ack?) => {
      try {
        const conversations = await chatService.getConversations(userId);
        ack?.(conversations);
      } catch (err) {
        ack?.({ error: (err as Error).message });
      }
    });

    socket.on(
      SOCKET_EVENTS.GET_MESSAGES,
      async (
        data: { roomId: string; limit?: number; before?: string },
        ack?
      ) => {
        try {
          const result = await chatService.getMessages(
            data.roomId,
            userId,
            data.limit,
            data.before
          );
          ack?.(result.messages);
        } catch (err) {
          ack?.({ error: (err as Error).message });
        }
      }
    );

    socket.on(
      SOCKET_EVENTS.CREATE_ROOM,
      async (recipientId: string, ack?) => {
        try {
          const room = await chatService.getOrCreateDirectRoom(
            userId,
            recipientId
          );
          await this.notifyNewChat(room);
          ack?.(room);
        } catch (err) {
          ack?.({ error: (err as Error).message });
        }
      }
    );

    socket.on(
      SOCKET_EVENTS.CREATE_GROUP,
      async (data: { name: string; userIds: string[] }, ack?) => {
        try {
          const body = validateCreateRoom({ name: data.name, userIds: data.userIds });
          const room = await chatService.createRoom(userId, body);
          await this.notifyNewChat(room);
          ack?.(room);
        } catch (err) {
          ack?.({ error: (err as Error).message });
        }
      }
    );

    socket.on(SOCKET_EVENTS.GET_USERS, async (ack?) => {
      try {
        const users = await chatService.getConnectedUsers(
          userId,
          socket.data.userType
        );
        ack?.(users);
      } catch (err) {
        ack?.({ error: (err as Error).message });
      }
    });
  }

  emitToRoom(roomChannel: string, event: string, payload: unknown): void {
    if (!this.io) return;
    this.io.to(roomChannel).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    if (!this.io) return;
    presenceService.emitToUser(this.io, userId, event, payload);
  }

  async joinParticipantsToRoom(roomId: string): Promise<void> {
    if (!this.io) return;
    const participants = await chatService.getRoomParticipants(roomId);
    await presenceService.joinParticipantsToRoom(
      this.io,
      roomId,
      participants.map((p) => p.user_id)
    );
  }

  async notifyNewChat(room: ChatRoomResponse): Promise<void> {
    if (!this.io || !room.participants) return;

    const roomChannel = getRoomChannel(room.id);
    for (const participant of room.participants) {
      await presenceService.joinUserToRoom(
        this.io,
        participant.user_id,
        room.id
      );
    }
    this.io.to(roomChannel).emit(SOCKET_EVENTS.NEW_CHAT, room);
  }

  notifyChatCleared(roomId: string, userId: string): void {
    this.emitToUser(userId, SOCKET_EVENTS.CHAT_CLEARED, { roomId });
  }
}

let chatSocketHandler: ChatSocketHandler | null = null;

export const registerChatSocketHandlers = (io: SocketServer): void => {
  chatSocketHandler = new ChatSocketHandler();
  chatSocketHandler.init(io);
};

export const getChatSocketHandler = (): ChatSocketHandler => {
  if (!chatSocketHandler) {
    throw new Error("Chat socket handler not initialized");
  }
  return chatSocketHandler;
};
