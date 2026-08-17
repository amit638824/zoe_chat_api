import express from "express";
import cors from "cors";
import path from "path";
import fileUpload from "express-fileupload";
import chatRouter from "./routers/chat.router";
import { authMiddleware } from "./middlewares/auth.middleware";
import { errorMiddleware } from "./middlewares/error.middleware";
import { ensureUploadDir } from "./middlewares/upload.middleware";
import { createResponse } from "./utils/response";

export const createApp = (): express.Application => {
  ensureUploadDir();

  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(
    fileUpload({
      createParentPath: true,
      limits: { fileSize: 25 * 1024 * 1024 },
    })
  );

  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  app.get("/health", (_req, res) => {
    return createResponse(res, 200, "Service is healthy", {
      status: "ok",
    });
  });

  app.use("/api/chat", authMiddleware, chatRouter);

  app.use((_req, res) => {
    return createResponse(res, 404, "Route not found", [], false, true);
  });

  app.use(errorMiddleware);

  return app;
};
