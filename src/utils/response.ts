import { Response } from "express";

export interface ApiResponse<T = unknown> {
  success: boolean;
  code: number;
  message: string;
  data: T;
  error: boolean;
  meta?: Record<string, unknown>;
}

export const createResponse = <T = unknown>(
  res: Response,
  statusCode: number = 200,
  message: string = "OK",
  data: T = [] as unknown as T,
  success: boolean = true,
  error: boolean = false,
  meta?: Record<string, unknown>
): Response => {
  const body: ApiResponse<T> = {
    success,
    code: statusCode,
    message,
    data,
    error,
  };
  if (meta) {
    body.meta = meta;
  }
  return res.status(statusCode).json(body);
};
