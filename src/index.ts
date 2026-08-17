import http from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { initSocket } from "./socket/socket";
import { closePool, testConnection } from "./config/database";

const startServer = async (): Promise<void> => {
  const dbCheck = await testConnection();
  if (dbCheck.ok) {
    console.log(`✅ Database connected (${env.db.host}/${env.db.database})`);
    if (dbCheck.tables?.length) {
      console.log(`   Tables: ${dbCheck.tables.join(", ")}`);
    } else {
      console.warn("⚠️  No tables found — run: mysql < database/schema.sql");
    }
  } else {
    console.error(`❌ Database connection failed: ${dbCheck.message}`);
    console.error("   Fix .env credentials or whitelist your IP on MySQL host");
  }

  const app = createApp();
  const httpServer = http.createServer(app);

  initSocket(httpServer);

  httpServer.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`❌ Port ${env.port} is already in use`);
      console.error("   Stop the other process or change PORT in .env");
      process.exit(1);
    }
    throw err;
  });

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
};

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
