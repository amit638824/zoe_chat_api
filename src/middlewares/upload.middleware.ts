import path from "path";
import fs from "fs";
import { Request, Response, NextFunction } from "express";
import { UploadedFile } from "express-fileupload";
import { AppServiceError } from "../services/chat.service";

const ALLOWED_MEDIA_TYPES = ["image", "video", "audio", "document", "file"];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export const ensureUploadDir = (): void => {
  const uploadDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
};

export const validateUpload = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    if (!req.files || !req.files.file) {
      throw new AppServiceError("No file uploaded. Use field name 'file'");
    }

    const file = req.files.file as UploadedFile;

    if (file.size > MAX_FILE_SIZE) {
      throw new AppServiceError("File size exceeds 25MB limit");
    }

    const mediaType = (req.body.mediaType as string) || "file";
    if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) {
      throw new AppServiceError(
        `Invalid mediaType. Allowed: ${ALLOWED_MEDIA_TYPES.join(", ")}`
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};
