# ZOE Chat API

Live: **https://chatapizoe.techwagger.com**

Real-time chat backend — Node.js, Express, TypeScript, MySQL, Socket.IO.

**Flutter app me chat lagane ke liye pura flow:** [FLUTTER_CHAT.md](./FLUTTER_CHAT.md)

## Features

- Direct (1:1) and group chat rooms
- Send, edit, delete messages with AES-256-GCM encryption
- Message delivery & read receipts
- Paginated message history
- Conversation list with unread counts
- File/image/video attachments (local `uploads/` storage)
- Real-time messaging via Socket.IO
- Typing indicators & online presence
- E2E public key registration
- Connected users via ZOE Blueprint external API

## Project Structure

```text
zoe_chat_api/
├── database/schema.sql
├── uploads/
└── src/
    ├── config/          # env + mysql2 pool
    ├── constants/       # events.ts, contactMessage.ts
    ├── middlewares/     # auth, error, upload
    ├── routers/         chat.router.ts
    ├── controllers/     chat.controller.ts
    ├── services/          chat.service.ts, user.service.ts, presence.service.ts
    ├── repositories/      chat.repository.ts
    ├── types/             chat.types.ts
    ├── validations/       chat.validation.ts
    ├── socket/          # Socket.IO initialization + handlers
    ├── utils/           # createResponse helper
    ├── app.ts
    └── index.ts
```

## Prerequisites

- Node.js 18+
- MySQL 8+

## Setup

### 1. Install dependencies

```bash
cd zoe_chat_api
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your MySQL credentials and encryption secret.

### 3. Create database

```bash
mysql -u root -p < database/schema.sql
```

### 4. Run development server

```bash
npm run dev
```

### 5. Production build

```bash
npm run build
npm start
```

## Authentication

All REST endpoints require the `x-user-id` header. Optional `x-user-type` header (default: `VOL`).

Socket.IO connection requires `auth.userId` in the handshake:

```js
const socket = io("http://localhost:5000", {
  auth: { userId: "V20230621TeDAzf6TeqE", userType: "VOL" },
});
```

## REST API Endpoints

Base URL: `/api/chat`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users` | Get connected users (external API) |
| GET | `/conversations` | List active conversations |
| POST | `/rooms` | Create direct or group room |
| GET | `/rooms/:roomId` | Get room details |
| GET | `/rooms/:roomId/messages?limit=20&before=ISO_DATE` | Message history |
| GET | `/rooms/:roomId/participants` | Room participants |
| GET | `/rooms/:roomId/left-participants` | Left/removed participants |
| POST | `/messages` | Send message |
| PATCH | `/messages/:messageId` | Edit message |
| DELETE | `/messages/:messageId` | Delete message |
| POST | `/messages/:messageId/seen` | Mark message seen |
| POST | `/rooms/:roomId/seen` | Mark all room messages seen |
| DELETE | `/rooms/:roomId/clear` | Clear chat history |
| PATCH | `/rooms/:roomId` | Update group name/image |
| POST | `/rooms/:roomId/participants` | Add group members |
| DELETE | `/rooms/:roomId/participants/:userId` | Remove member |
| POST | `/rooms/:roomId/exit` | Exit group |
| POST | `/upload` | Upload file attachment |

### Response Format

```json
{
  "success": true,
  "code": 200,
  "message": "OK",
  "data": [],
  "error": false
}
```

## API Usage Examples

### Get connected users

```bash
curl -X GET http://localhost:5000/api/chat/users \
  -H "x-user-id: V20230621TeDAzf6TeqE" \
  -H "x-user-type: VOL"
```

### Create direct chat room

```bash
curl -X POST http://localhost:5000/api/chat/rooms \
  -H "Content-Type: application/json" \
  -H "x-user-id: V20230621TeDAzf6TeqE" \
  -d '{"recipientId": "OTHER_USER_ID"}'
```

### Create group chat

```bash
curl -X POST http://localhost:5000/api/chat/rooms \
  -H "Content-Type: application/json" \
  -H "x-user-id: V20230621TeDAzf6TeqE" \
  -d '{"name": "Family Group", "userIds": ["USER_1", "USER_2"]}'
```

### Send message

```bash
curl -X POST http://localhost:5000/api/chat/messages \
  -H "Content-Type: application/json" \
  -H "x-user-id: V20230621TeDAzf6TeqE" \
  -d '{"roomId": "ROOM_UUID", "content": "Hello!"}'
```

### Upload file

```bash
curl -X POST http://localhost:5000/api/chat/upload \
  -H "x-user-id: V20230621TeDAzf6TeqE" \
  -F "file=@/path/to/image.jpg" \
  -F "mediaType=image"
```

Then send message with attachment:

```bash
curl -X POST http://localhost:5000/api/chat/messages \
  -H "Content-Type: application/json" \
  -H "x-user-id: V20230621TeDAzf6TeqE" \
  -d '{"roomId": "ROOM_UUID", "mediaIds": ["MEDIA_UUID"]}'
```

### Get messages (paginated)

```bash
curl "http://localhost:5000/api/chat/rooms/ROOM_UUID/messages?limit=20" \
  -H "x-user-id: V20230621TeDAzf6TeqE"
```

## Socket.IO Events

Defined in `src/constants/events.ts`.

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join_chat` | `roomId` | Join a chat room |
| `leave_chat` | `roomId` | Leave a chat room |
| `send_message` | `{ roomId, content?, mediaIds? }` | Send message |
| `edit_message` | `{ messageId, content }` | Edit message |
| `delete_message` | `{ messageId }` | Delete message |
| `message_seen` | `messageId` | Mark seen |
| `message_delivered` | `messageId` | Ack delivery |
| `start_typing` | `{ roomId }` | Typing started |
| `stop_typing` | `{ roomId }` | Typing stopped |
| `get_conversations` | — | Fetch conversations |
| `get_messages` | `{ roomId, limit?, before? }` | Fetch messages |
| `create_room` | `recipientId` | Create direct room |
| `create_group` | `{ name, userIds }` | Create group |
| `get_users` | — | Connected users |
| `register_public_key` | `publicKey` | Register E2E key |
| `get_user_public_key` | `userId` | Get user public key |
| `get_room_public_keys` | `roomId` | Get room keys |

### Server → Client

| Event | Description |
|-------|-------------|
| `receive_message` | New message received |
| `message_edited` | Message was edited |
| `message_deleted` | Message was deleted |
| `message_seen` | Read receipt |
| `message_delivered` | Delivery receipt |
| `room_seen` | All room messages seen |
| `new_chat` | New room created |
| `chat_cleared` | History cleared |
| `room_updated` | Room details changed |
| `start_typing` / `stop_typing` | Typing indicators |
| `user_online` / `user_offline` | Presence updates |
| `get_online_users` | Initial online users list |

### Socket Example

```js
import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  auth: { userId: "V20230621TeDAzf6TeqE", userType: "VOL" },
});

socket.on("connect", () => {
  socket.emit("join_chat", "ROOM_UUID");
});

socket.emit("send_message", { roomId: "ROOM_UUID", content: "Hi via socket!" }, (response) => {
  console.log("Sent:", response);
});

socket.on("receive_message", (message) => {
  console.log("New message:", message);
});
```

## Business Rules (from if_api)

- Message content is encrypted at rest (AES-256-GCM)
- Messages cannot be edited after being seen by another user
- Messages cannot be edited 15 minutes after delivery
- Marking messages as seen also marks them as delivered
- Clearing DM history sets `left_at` for the user; sending a new message reactivates the room
- Group clear only resets `joined_at` (hides older messages for that user)

## External User API

Connected users are fetched from:

```
POST https://www.zoeblueprint.com/api/user-access.php?api_key=KEY&action=get_connected_users
Body: { "user_id": "...", "user_type": "VOL" }
```

Configure via `USER_ACCESS_API_URL` and `USER_ACCESS_API_KEY` in `.env`.

## License

Private — ZOE project.
