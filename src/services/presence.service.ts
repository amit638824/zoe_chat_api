import { Server as SocketServer } from "socket.io";
import { AuthenticatedUser } from "../types/chat.types";

export class PresenceService {
  private readonly activeConnections = new Map<string, Set<string>>();

  registerConnection(userId: string, socketId: string): boolean {
    const isFirstConnection = !this.activeConnections.has(userId);
    if (!this.activeConnections.has(userId)) {
      this.activeConnections.set(userId, new Set());
    }
    this.activeConnections.get(userId)!.add(socketId);
    return isFirstConnection;
  }

  deregisterConnection(userId: string, socketId: string): boolean {
    if (this.activeConnections.has(userId)) {
      const userSockets = this.activeConnections.get(userId)!;
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.activeConnections.delete(userId);
        return true;
      }
    }
    return false;
  }

  isUserOnline(userId: string): boolean {
    return this.activeConnections.has(userId);
  }

  getUserSocketIds(userId: string): string[] {
    return Array.from(this.activeConnections.get(userId) || []);
  }

  getOnlineUsers(): string[] {
    return Array.from(this.activeConnections.keys());
  }

  async joinUserToRoom(
    io: SocketServer,
    userId: string,
    roomId: string
  ): Promise<void> {
    const roomName = `room_${roomId}`;
    const socketIds = this.getUserSocketIds(userId);
    for (const socketId of socketIds) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        await socket.join(roomName);
      }
    }
  }

  async joinParticipantsToRoom(
    io: SocketServer,
    roomId: string,
    participantUserIds: string[]
  ): Promise<void> {
    for (const userId of participantUserIds) {
      await this.joinUserToRoom(io, userId, roomId);
    }
  }

  emitToUser(
    io: SocketServer,
    userId: string,
    event: string,
    payload: unknown
  ): void {
    const socketIds = this.getUserSocketIds(userId);
    for (const socketId of socketIds) {
      io.to(socketId).emit(event, payload);
    }
  }
}

export const presenceService = new PresenceService();

export interface AuthenticatedSocket {
  id: string;
  user?: AuthenticatedUser;
  join: (room: string) => Promise<void>;
  leave: (room: string) => Promise<void>;
  to: (room: string) => { emit: (event: string, payload: unknown) => void };
  emit: (event: string, payload?: unknown) => void;
  disconnect: (close?: boolean) => void;
  handshake: {
    auth?: { userId?: string; userType?: string };
    headers?: Record<string, string>;
    query?: Record<string, string>;
  };
}
