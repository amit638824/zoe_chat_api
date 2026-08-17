export const SOCKET_EVENTS = {
  CONNECT: "connect",
  DISCONNECT: "disconnect",

  JOIN_CHAT: "join_chat",
  LEAVE_CHAT: "leave_chat",

  SEND_MESSAGE: "send_message",
  RECEIVE_MESSAGE: "receive_message",

  EDIT_MESSAGE: "edit_message",
  MESSAGE_EDITED: "message_edited",

  DELETE_MESSAGE: "delete_message",
  MESSAGE_DELETED: "message_deleted",

  START_TYPING: "start_typing",
  STOP_TYPING: "stop_typing",

  MESSAGE_SEEN: "message_seen",
  MESSAGE_DELIVERED: "message_delivered",
  ROOM_SEEN: "room_seen",

  USER_ONLINE: "user_online",
  USER_OFFLINE: "user_offline",

  NEW_CHAT: "new_chat",
  CHAT_CLEARED: "chat_cleared",
  ROOM_UPDATED: "room_updated",

  GET_ONLINE_USERS: "get_online_users",
  GET_CONVERSATIONS: "get_conversations",
  GET_MESSAGES: "get_messages",
  GET_USERS: "get_users",
  CREATE_ROOM: "create_room",
  CREATE_GROUP: "create_group",

  REGISTER_PUBLIC_KEY: "register_public_key",
  GET_USER_PUBLIC_KEY: "get_user_public_key",
  GET_ROOM_PUBLIC_KEYS: "get_room_public_keys",
} as const;

export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

export const getRoomChannel = (roomId: string): string => `room_${roomId}`;
