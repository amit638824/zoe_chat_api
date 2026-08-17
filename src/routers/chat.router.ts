import { Router } from "express";
import { chatController } from "../controllers/chat.controller";
import { validateUpload } from "../middlewares/upload.middleware";
const chatRouter = Router();

// Users & conversations
chatRouter.get("/users", chatController.getUsers);
chatRouter.get("/conversations", chatController.getConversations);

// Rooms
chatRouter.post("/rooms", chatController.createRoom);
chatRouter.get("/rooms/:roomId", chatController.getRoom);
chatRouter.patch("/rooms/:roomId", chatController.updateRoom);
chatRouter.post("/rooms/:roomId/exit", chatController.exitRoom);
chatRouter.post("/rooms/:roomId/seen", chatController.markRoomSeen);
chatRouter.delete("/rooms/:roomId/clear", chatController.clearRoomHistory);

// Room participants
chatRouter.get("/rooms/:roomId/participants", chatController.getParticipants);
chatRouter.get(
  "/rooms/:roomId/left-participants",
  chatController.getLeftParticipants
);
chatRouter.post("/rooms/:roomId/participants", chatController.addParticipants);
chatRouter.delete(
  "/rooms/:roomId/participants/:participantUserId",
  chatController.removeParticipant
);

// Messages
chatRouter.get("/rooms/:roomId/messages", chatController.getMessages);
chatRouter.post("/messages", chatController.sendMessage);
chatRouter.patch("/messages/:messageId", chatController.editMessage);
chatRouter.delete("/messages/:messageId", chatController.deleteMessage);
chatRouter.post("/messages/:messageId/seen", chatController.markMessageSeen);

// File upload
chatRouter.post("/upload", validateUpload, chatController.uploadFile);

export default chatRouter;
