import http from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { initSocket } from "./socket/socket";
import { closePool } from "./config/database";

const app = createApp();
const httpServer = http.createServer(app);

initSocket(httpServer);

httpServer.listen(env.port, () => {
  console.log(`ZOE Chat API running on port ${env.port}`);
  console.log(`REST: http://localhost:${env.port}/api/chat`);
  console.log(`Socket.IO: ws://localhost:${env.port}`);
});

const shutdown = async (signal: string) => {
  console.log(`\n${signal} received. Shutting down...`);
  httpServer.close(async () => {
    await closePool();
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
