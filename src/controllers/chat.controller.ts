import { Response, NextFunction } from "express";
import { createResponse } from "../utils/response";
import { ChatRequest } from "../types/chat.types";
import { chatService } from "../services/chat.service";
import {
  validateAddParticipants,
  validateCreateRoom,
  validateEditMessage,
  validatePagination,
  validateSendMessage,
  validateUpdateRoom,
} from "../validations/chat.validation";
import { getChatSocketHandler } from "../socket/chat.socket";
import { SOCKET_EVENTS, getRoomChannel } from "../constants/events";
import { contactMessage } from "../constants/contactMessage";
import { param } from "../utils/params";

export class ChatController {
  getUsers = async (
    req: ChatRequest,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const users = await chatService.getConnectedUsers(
        req.user!.id,
        req.user!.userType
      );
      return createResponse(
        res,
        200,
        "Chat users retrieved successfully",
        users
      );
    } catch (error) {
      next(error);
    }
  };

  getConversations = async (
    req: ChatRequest,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const conversations = await chatService.getConversations(req.user!.id);
      return createResponse(
        res,
        200,
        "Conversations retrieved successfully",
        conversations
      );
    } catch (error) {
      next(error);
    }
  };

  createRoom = async (
    req: ChatRequest,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const body = validateCreateRoom(req.body);
      const room = await chatService.createRoom(req.user!.id, body);
      await getChatSocketHandler().notifyNewChat(room);
      return createResponse(res, 201, "Room created successfully", room);
    } catch (error) {
      next(error);
    }
  };

  getRoom = async (
    req: ChatRequest,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const roomId = param(req.params.roomId);
      const room = await chatService.getRoom(roomId);
      if (!room) {
        return createResponse(res, 404, "Room not found", [], false, true);
      }
      return createResponse(res, 200, "Room retrieved successfully", room);
    } catch (error) {
      next(error);
    }
  };

  getMessages = async (
    req: ChatRequest,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const roomId = param(req.params.roomId);
      const { limit, before } = validatePagination(
        req.query.limit as string,
        req.query.before as string
      );
      const { messages, hasMore } = await chatService.getMessages(
        roomId,
        req.user!.id,
        limit,
        before
      );
      return createResponse(
        res,
        200,
        "Messages retrieved successfully",
        messages,
        true,
        false,
        { hasMore, limit }
      );
    } catch (error) {
      next(error);
    }
  };

  sendMessage = async (
    req: ChatRequest,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const body = validateSendMessage(req.body);
      const message = await chatService.sendMessage(req.user!.id, body);
      const payload = contactMessage.build(message);

      const socketHandler = getChatSocketHandler();
      await socketHandler.joinParticipantsToRoom(body.roomId);
      socketHandler.emitToRoom(
        getRoomChannel(body.roomId),
        SOCKET_EVENTS.RECEIVE_MESSAGE,
        payload
      );

      return createResponse(res, 201, "Message sent successfully", payload);
    } catch (error) {
      next(error);
    }
  };

  uploadFile = async (
    req: ChatRequest,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const file = req.files!.file as {
        name: string;
        mimetype: string;
        size: number;
        mv: (path: string) => Promise<void>;
      };
      const mediaType = (req.body.mediaType as string) || "file";
      const result = await chatService.uploadFile(
        req.user!.id,
        file,
        mediaType
      );
      return createResponse(res, 201, "File uploaded successfully", result);
    } catch (error) {
      next(error);
    }
  };

  editMessage = async (
    req: ChatRequest,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const messageId = param(req.params.messageId);
      const body = validateEditMessage({
        messageId,
        content: req.body.content,
      });
      const message = await chatService.editMessage(req.user!.id, body);
      const payload = contactMessage.build(message);

      getChatSocketHandler().emitToRoom(
        getRoomChannel(message.room_id),
        SOCKET_EVENTS.MESSAGE_EDITED,
        payload
      );

      return createResponse(res, 200, "Message edited successfully", payload);
    } catch (error) {
      next(error);
    }
  };

  deleteMessage = async (
    req: ChatRequest,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const messageId = param(req.params.messageId);
      const message = await chatService.deleteMessage(
        req.user!.id,
        messageId
      );

      getChatSocketHandler().emitToRoom(
        getRoomChannel(message.room_id),
        SOCKET_EVENTS.MESSAGE_DELETED,
        { messageId }
      );

      return createResponse(res, 200, "Message deleted successfully", {
        messageId,
      });
    } catch (error) {
      next(error);
    }
  };

  markMessageSeen = async (
    req: ChatRequest,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const messageId = param(req.params.messageId);
      const readReceipt = await chatService.markMessageAsSeen(
        messageId,
        req.user!.id
      );

      if (!readReceipt) {
        return createResponse(
          res,
          200,
          "No action taken or self-seen receipt ignored"
        );
      }

      const message = await chatService.getMessage(messageId);
      if (message) {
        getChatSocketHandler().emitToRoom(
          getRoomChannel(message.room_id),
          SOCKET_EVENTS.MESSAGE_SEEN,
          contactMessage.seen(messageId, req.user!.id, readReceipt.read_at)
        );
      }

      return createResponse(
        res,
        200,
        "Message marked as seen successfully",
        readReceipt
      );
    } catch (error) {
      next(error);
    }
  };

  markRoomSeen = async (
    req: ChatRequest,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const roomId = param(req.params.roomId);
      const receipts = await chatService.markRoomMessagesAsSeen(
        roomId,
        req.user!.id
      );

      getChatSocketHandler().emitToRoom(
        getRoomChannel(roomId),
        SOCKET_EVENTS.ROOM_SEEN,
        contactMessage.roomSeen(
          roomId,
          req.user!.id,
          new Date().toISOString()
        )
      );

      return createResponse(
        res,
        200,
        "Room messages marked as seen successfully",
        { count: receipts.length }
      );
    } catch (error) {
      next(error);
    }
  };

  clearRoomHistory = async (
    req: ChatRequest,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const roomId = param(req.params.roomId);
      await chatService.clearRoomHistory(roomId, req.user!.id);
      getChatSocketHandler().notifyChatCleared(roomId, req.user!.id);
      return createResponse(res, 200, "Chat history cleared successfully");
    } catch (error) {
      next(error);
    }
  };

  updateRoom = async (
    req: ChatRequest,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const roomId = param(req.params.roomId);
      const isParticipant = await chatService.isRoomParticipant(
        roomId,
        req.user!.id
      );
      if (!isParticipant) {
        return createResponse(
          res,
          403,
          "You are not a participant in this room",
          [],
          false,
          true
        );
      }

      const body = validateUpdateRoom(req.body);
      const updatedRoom = await chatService.updateRoomDetails(roomId, body);

      getChatSocketHandler().emitToRoom(
        getRoomChannel(roomId),
        SOCKET_EVENTS.ROOM_UPDATED,
        updatedRoom
      );

      return createResponse(
        res,
        200,
        "Room details updated successfully",
        updatedRoom
      );
    } catch (error) {
      next(error);
    }
  };

  getParticipants = async (
    req: ChatRequest,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const roomId = param(req.params.roomId);
      const participants = await chatService.getRoomParticipants(roomId);
      return createResponse(
        res,
        200,
        "Participants retrieved successfully",
        participants
      );
    } catch (error) {
      next(error);
    }
  };

  getLeftParticipants = async (
    req: ChatRequest,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const roomId = param(req.params.roomId);
      const participants = await chatService.getLeftParticipants(roomId);
      return createResponse(
        res,
        200,
        "Left participants retrieved successfully",
        participants
      );
    } catch (error) {
      next(error);
    }
  };

  addParticipants = async (
    req: ChatRequest,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const roomId = param(req.params.roomId);
      const isAdmin = await chatService.isRoomAdmin(roomId, req.user!.id);
      if (!isAdmin) {
        return createResponse(
          res,
          403,
          "Only admins can add participants to this room",
          [],
          false,
          true
        );
      }

      const userIds = validateAddParticipants(req.body);
      const updatedRoom = await chatService.addRoomParticipants(
        roomId,
        userIds
      );

      getChatSocketHandler().emitToRoom(
        getRoomChannel(roomId),
        SOCKET_EVENTS.ROOM_UPDATED,
        updatedRoom
      );

      return createResponse(
        res,
        200,
        "Participants added successfully",
        updatedRoom
      );
    } catch (error) {
      next(error);
    }
  };

  removeParticipant = async (
    req: ChatRequest,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const roomId = param(req.params.roomId);
      const participantUserId = param(req.params.participantUserId);
      const isAdmin = await chatService.isRoomAdmin(roomId, req.user!.id);
      if (!isAdmin) {
        return createResponse(
          res,
          403,
          "Only admins can remove participants from this room",
          [],
          false,
          true
        );
      }

      if (req.user!.id === participantUserId) {
        return createResponse(
          res,
          400,
          "Admins cannot remove themselves. Use the exit route instead.",
          [],
          false,
          true
        );
      }

      const updatedRoom = await chatService.removeRoomParticipant(
        roomId,
        participantUserId
      );

      getChatSocketHandler().emitToRoom(
        getRoomChannel(roomId),
        SOCKET_EVENTS.ROOM_UPDATED,
        updatedRoom
      );

      return createResponse(
        res,
        200,
        "Participant removed successfully",
        updatedRoom
      );
    } catch (error) {
      next(error);
    }
  };

  exitRoom = async (
    req: ChatRequest,
    res: Response,
    next: NextFunction
  ): Promise<Response | void> => {
    try {
      const roomId = param(req.params.roomId);
      const isParticipant = await chatService.isRoomParticipant(
        roomId,
        req.user!.id
      );
      if (!isParticipant) {
        return createResponse(
          res,
          403,
          "You are not a participant in this room",
          [],
          false,
          true
        );
      }

      const updatedRoom = await chatService.removeRoomParticipant(
        roomId,
        req.user!.id
      );

      getChatSocketHandler().emitToRoom(
        getRoomChannel(roomId),
        SOCKET_EVENTS.ROOM_UPDATED,
        updatedRoom
      );

      return createResponse(res, 200, "Exited room successfully");
    } catch (error) {
      next(error);
    }
  };
}

export const chatController = new ChatController();
