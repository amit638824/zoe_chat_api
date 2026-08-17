import { Request, Response, NextFunction } from "express";
import { createResponse } from "../utils/response";
import { AppServiceError } from "../services/chat.service";
import { ValidationError } from "../validations/chat.validation";
import { env } from "../config/env";

const isDev = env.nodeEnv !== "production";

export const errorMiddleware = (
  err: Error & { code?: string; errno?: number; sqlMessage?: string },
  _req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  console.error("[Error]", err.message || err);

  if (err instanceof ValidationError) {
    return createResponse(
      res,
      err.statusCode,
      err.message,
      [],
      false,
      true
    );
  }

  if (err instanceof AppServiceError) {
    return createResponse(
      res,
      err.statusCode,
      err.message,
      [],
      false,
      true
    );
  }

  // MySQL errors
  if (err.code?.startsWith("ER_")) {
    const message = isDev
      ? err.sqlMessage || err.message
      : "Database error occurred";
    return createResponse(res, 500, message, [], false, true);
  }

  const statusCode =
    (err as { statusCode?: number }).statusCode || 500;
  const message =
    statusCode === 500 && !isDev ? "Something went wrong" : err.message;

  return createResponse(res, statusCode, message, [], false, true);
};
