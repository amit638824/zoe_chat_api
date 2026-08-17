import { Request, Response, NextFunction } from "express";
import { createResponse } from "../utils/response";
import { AppServiceError } from "../services/chat.service";
import { ValidationError } from "../validations/chat.validation";

export const errorMiddleware = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  console.error("[Error]", err);

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

  const statusCode =
    (err as { statusCode?: number }).statusCode || 500;
  const message =
    statusCode === 500 ? "Something went wrong" : err.message;

  return createResponse(res, statusCode, message, [], false, true);
};
