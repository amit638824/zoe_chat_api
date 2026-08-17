import {
  CreateRoomDto,
  EditMessageDto,
  SendMessageDto,
} from "../types/chat.types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ValidationError extends Error {
  statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const assertNonEmptyString = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`${field} is required`);
  }
  return value.trim();
};

const assertUuid = (value: unknown, field: string): string => {
  const str = assertNonEmptyString(value, field);
  if (!UUID_REGEX.test(str)) {
    throw new ValidationError(`${field} must be a valid UUID`);
  }
  return str;
};

const assertUserId = (value: unknown, field: string): string => {
  return assertNonEmptyString(value, field);
};

export const validateSendMessage = (body: unknown): SendMessageDto => {
  if (!body || typeof body !== "object") {
    throw new ValidationError("Invalid message payload");
  }
  const payload = body as Record<string, unknown>;
  const roomId = assertUuid(payload.roomId, "roomId");

  const content =
    payload.content !== undefined && payload.content !== null
      ? String(payload.content)
      : undefined;

  let mediaIds: string[] | undefined;
  if (payload.mediaIds !== undefined) {
    if (!Array.isArray(payload.mediaIds)) {
      throw new ValidationError("mediaIds must be an array");
    }
    mediaIds = payload.mediaIds.map((id, i) =>
      assertUuid(id, `mediaIds[${i}]`)
    );
  }

  if (!content && (!mediaIds || mediaIds.length === 0)) {
    throw new ValidationError("Message must have content or attachments");
  }

  return { roomId, content, mediaIds };
};

export const validateEditMessage = (body: unknown): EditMessageDto => {
  if (!body || typeof body !== "object") {
    throw new ValidationError("Invalid edit payload");
  }
  const payload = body as Record<string, unknown>;
  return {
    messageId: assertUuid(payload.messageId, "messageId"),
    content: assertNonEmptyString(payload.content, "content"),
  };
};

export const validateDeleteMessage = (body: unknown): string => {
  if (!body || typeof body !== "object") {
    throw new ValidationError("Invalid delete payload");
  }
  return assertUuid((body as Record<string, unknown>).messageId, "messageId");
};

export const validateCreateRoom = (body: unknown): CreateRoomDto => {
  if (!body || typeof body !== "object") {
    throw new ValidationError("Invalid room creation payload");
  }
  const payload = body as Record<string, unknown>;

  if (payload.name && payload.userIds) {
    if (!Array.isArray(payload.userIds) || payload.userIds.length === 0) {
      throw new ValidationError("userIds must be a non-empty array for group rooms");
    }
    return {
      name: assertNonEmptyString(payload.name, "name"),
      userIds: payload.userIds.map((id, i) =>
        assertUserId(id, `userIds[${i}]`)
      ),
    };
  }

  if (payload.recipientId) {
    return {
      recipientId: assertUserId(payload.recipientId, "recipientId"),
    };
  }

  throw new ValidationError(
    "Invalid room creation payload: provide recipientId or name + userIds"
  );
};

export const validateUpdateRoom = (body: unknown): {
  name?: string;
  groupImage?: string;
} => {
  if (!body || typeof body !== "object") {
    throw new ValidationError("Invalid room update payload");
  }
  const payload = body as Record<string, unknown>;
  const result: { name?: string; groupImage?: string } = {};

  if (payload.name !== undefined) {
    result.name = assertNonEmptyString(payload.name, "name");
  }
  if (payload.groupImage !== undefined) {
    result.groupImage = assertNonEmptyString(payload.groupImage, "groupImage");
  }

  if (!result.name && !result.groupImage) {
    throw new ValidationError("At least one of name or groupImage is required");
  }

  return result;
};

export const validateAddParticipants = (body: unknown): string[] => {
  if (!body || typeof body !== "object") {
    throw new ValidationError("Invalid participants payload");
  }
  const userIds = (body as Record<string, unknown>).userIds;
  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new ValidationError("userIds must be a non-empty array");
  }
  return userIds.map((id, i) => assertUserId(id, `userIds[${i}]`));
};

export const validateTyping = (body: unknown): string => {
  if (!body || typeof body !== "object") {
    throw new ValidationError("Invalid typing payload");
  }
  return assertUuid((body as Record<string, unknown>).roomId, "roomId");
};

export const validatePagination = (
  limit?: string,
  before?: string
): { limit: number; before?: string } => {
  const parsedLimit = limit ? parseInt(limit, 10) : 20;
  const safeLimit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), 50)
    : 20;
  return { limit: safeLimit, before };
};
