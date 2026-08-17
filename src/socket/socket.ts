import { Server as HttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import { registerChatSocketHandlers } from "./chat.socket";

let io: SocketServer | null = null;

export const initSocket = (httpServer: HttpServer): SocketServer => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  registerChatSocketHandlers(io);
  return io;
};

export const getIO = (): SocketServer => {
  if (!io) {
    throw new Error("Socket.IO not initialized");
  }
  return io;
};
