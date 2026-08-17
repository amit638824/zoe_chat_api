import { Response, NextFunction } from "express";
import { ChatRequest } from "../types/chat.types";

export type AuthRequest = ChatRequest;

export const authMiddleware = (
  req: ChatRequest,
  res: Response,
  next: NextFunction
): void => {
  const userId =
    (req.headers["x-user-id"] as string) ||
    (req.body?.user_id as string) ||
    (req.query.user_id as string);

  if (!userId) {
    res.status(401).json({
      success: false,
      code: 401,
      message: "Unauthorized: x-user-id header is required",
      data: [],
      error: true,
    });
    return;
  }

  const userType =
    (req.headers["x-user-type"] as string) ||
    (req.body?.user_type as string) ||
    (req.query.user_type as string);

  req.user = { id: userId, userType };
  next();
};
