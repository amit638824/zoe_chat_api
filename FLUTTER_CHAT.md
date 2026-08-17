# ZOE Chat — Flutter Integration Guide

Live API: **https://chatapizoe.techwagger.com**

Is document se Flutter app me pura chat flow laga sakte ho: user list → conversation → real-time messages → files → seen/delivered.

---

## 1. Architecture Flow

```text
Flutter App
   │
   ├── REST  (history, rooms, upload, users)
   │     GET/POST  https://chatapizoe.techwagger.com/api/chat/...
   │
   └── Socket.IO  (live send/receive)
         wss://chatapizoe.techwagger.com
```

### Recommended screen flow

```text
Login (userId + userType already hai)
        ↓
Chat Users List          GET /api/chat/users
        ↓
Tap user → Create Room   POST /api/chat/rooms
        ↓
Conversation List        GET /api/chat/conversations
        ↓
Open Chat Screen
   ├── REST: GET /rooms/:roomId/messages   (old messages)
   ├── Socket: connect + join_chat
   ├── Socket: send_message / receive_message
   ├── REST: POST /upload  (file)
   └── Socket: message_seen / typing
```

---

## 2. Auth (har request me)

JWT nahi hai. Har REST call me headers:

```http
x-user-id: V20230621TeDAzf6TeqE
x-user-type: VOL
Content-Type: application/json
```

Socket connect pe:

```dart
auth: {
  "userId": "V20230621TeDAzf6TeqE",
  "userType": "VOL",
}
```

`user_id` ZOE Blueprint wala ID hoga. `user_type` example: `VOL`.

---

## 3. Flutter packages

`pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  http: ^1.2.2
  socket_io_client: ^3.0.2
  image_picker: ^1.1.2
  file_picker: ^8.1.4
  cached_network_image: ^3.4.1
```

```bash
flutter pub get
```

---

## 4. Config

```dart
class ChatConfig {
  static const String baseUrl = "https://chatapizoe.techwagger.com";
  static const String apiUrl = "$baseUrl/api/chat";
  static const String socketUrl = "https://chatapizoe.techwagger.com";
}
```

---

## 5. Standard API response

Har REST response isi format me aata hai:

```json
{
  "success": true,
  "code": 200,
  "message": "OK",
  "data": {},
  "error": false
}
```

Error:

```json
{
  "success": false,
  "code": 401,
  "message": "Unauthorized: x-user-id header is required",
  "data": [],
  "error": true
}
```

---

## 6. REST APIs

Base: `https://chatapizoe.techwagger.com/api/chat`

| Method | Endpoint | Kaam |
|--------|----------|------|
| GET | `/users` | Connected users |
| GET | `/conversations` | Chat list |
| POST | `/rooms` | DM ya group banao |
| GET | `/rooms/:roomId` | Room details |
| GET | `/rooms/:roomId/messages?limit=20` | Message history |
| POST | `/messages` | Message bhejo |
| PATCH | `/messages/:messageId` | Edit |
| DELETE | `/messages/:messageId` | Delete |
| POST | `/messages/:messageId/seen` | Single message seen |
| POST | `/rooms/:roomId/seen` | Room seen |
| POST | `/upload` | File upload (`file` + `mediaType`) |
| PATCH | `/rooms/:roomId` | Group name/image |
| POST | `/rooms/:roomId/participants` | Add members |
| DELETE | `/rooms/:roomId/participants/:userId` | Remove member |
| POST | `/rooms/:roomId/exit` | Group se nikalna |
| DELETE | `/rooms/:roomId/clear` | History clear |

---

## 7. Dart API service

```dart
import "dart:convert";
import "package:http/http.dart" as http;

class ChatApi {
  ChatApi({required this.userId, this.userType = "VOL"});

  final String userId;
  final String userType;

  Map<String, String> get _headers => {
        "Content-Type": "application/json",
        "x-user-id": userId,
        "x-user-type": userType,
      };

  Future<Map<String, dynamic>> _send(
    String method,
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final uri = Uri.parse("${ChatConfig.apiUrl}$path");
    late http.Response res;

    if (method == "GET") {
      res = await http.get(uri, headers: _headers);
    } else if (method == "POST") {
      res = await http.post(uri, headers: _headers, body: jsonEncode(body ?? {}));
    } else if (method == "PATCH") {
      res = await http.patch(uri, headers: _headers, body: jsonEncode(body ?? {}));
    } else if (method == "DELETE") {
      res = await http.delete(uri, headers: _headers);
    }

    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<List<dynamic>> getUsers() async {
    final json = await _send("GET", "/users");
    return (json["data"] as List?) ?? [];
  }

  Future<List<dynamic>> getConversations() async {
    final json = await _send("GET", "/conversations");
    return (json["data"] as List?) ?? [];
  }

  /// Direct chat
  Future<Map<String, dynamic>> createDirectRoom(String recipientId) async {
    final json = await _send("POST", "/rooms", body: {
      "recipientId": recipientId,
    });
    return json["data"] as Map<String, dynamic>;
  }

  /// Group chat
  Future<Map<String, dynamic>> createGroup({
    required String name,
    required List<String> userIds,
  }) async {
    final json = await _send("POST", "/rooms", body: {
      "name": name,
      "userIds": userIds,
    });
    return json["data"] as Map<String, dynamic>;
  }

  Future<List<dynamic>> getMessages(String roomId, {int limit = 20, String? before}) async {
    final q = before != null ? "?limit=$limit&before=$before" : "?limit=$limit";
    final json = await _send("GET", "/rooms/$roomId/messages$q");
    return (json["data"] as List?) ?? [];
  }

  Future<Map<String, dynamic>> sendMessage({
    required String roomId,
    String? content,
    List<String>? mediaIds,
  }) async {
    final json = await _send("POST", "/messages", body: {
      "roomId": roomId,
      if (content != null) "content": content,
      if (mediaIds != null) "mediaIds": mediaIds,
    });
    return json["data"] as Map<String, dynamic>;
  }

  Future<void> markRoomSeen(String roomId) async {
    await _send("POST", "/rooms/$roomId/seen");
  }

  Future<Map<String, dynamic>> uploadFile({
    required String filePath,
    required String fileName,
    String mediaType = "image",
  }) async {
    final uri = Uri.parse("${ChatConfig.apiUrl}/upload");
    final req = http.MultipartRequest("POST", uri);
    req.headers["x-user-id"] = userId;
    req.headers["x-user-type"] = userType;
    req.fields["mediaType"] = mediaType; // image | video | audio | document | file
    req.files.add(await http.MultipartFile.fromPath("file", filePath, filename: fileName));
    final streamed = await req.send();
    final body = await streamed.stream.bytesToString();
    return jsonDecode(body) as Map<String, dynamic>;
  }
}
```

---

## 8. Socket.IO service

```dart
import "package:socket_io_client/socket_io_client.dart" as IO;

class ChatSocket {
  ChatSocket({required this.userId, this.userType = "VOL"});

  final String userId;
  final String userType;
  IO.Socket? socket;

  void connect({
    required void Function(dynamic) onReceiveMessage,
    void Function(dynamic)? onMessageEdited,
    void Function(dynamic)? onMessageDeleted,
    void Function(dynamic)? onTyping,
    void Function(dynamic)? onStopTyping,
    void Function(dynamic)? onSeen,
    void Function(dynamic)? onDelivered,
    void Function(List<dynamic>)? onOnlineUsers,
    void Function(dynamic)? onUserOnline,
    void Function(dynamic)? onUserOffline,
    void Function(dynamic)? onNewChat,
    void Function(dynamic)? onRoomUpdated,
  }) {
    socket = IO.io(
      ChatConfig.socketUrl,
      IO.OptionBuilder()
          .setTransports(["websocket"])
          .disableAutoConnect()
          .setAuth({"userId": userId, "userType": userType})
          .build(),
    );

    socket!.onConnect((_) {
      print("Socket connected: ${socket!.id}");
    });

    socket!.on("receive_message", onReceiveMessage);
    socket!.on("message_edited", onMessageEdited ?? (_) {});
    socket!.on("message_deleted", onMessageDeleted ?? (_) {});
    socket!.on("start_typing", onTyping ?? (_) {});
    socket!.on("stop_typing", onStopTyping ?? (_) {});
    socket!.on("message_seen", onSeen ?? (_) {});
    socket!.on("message_delivered", onDelivered ?? (_) {});
    socket!.on("get_online_users", (data) => onOnlineUsers?.call(data as List<dynamic>));
    socket!.on("user_online", onUserOnline ?? (_) {});
    socket!.on("user_offline", onUserOffline ?? (_) {});
    socket!.on("new_chat", onNewChat ?? (_) {});
    socket!.on("room_updated", onRoomUpdated ?? (_) {});
    socket!.on("room_seen", (_) {});
    socket!.on("chat_cleared", (_) {});

    socket!.connect();
  }

  void joinRoom(String roomId) {
    socket?.emitWithAck("join_chat", roomId, ack: (data) {
      print("Joined room: $data");
    });
  }

  void leaveRoom(String roomId) {
    socket?.emit("leave_chat", roomId);
  }

  void sendMessage({
    required String roomId,
    String? content,
    List<String>? mediaIds,
    void Function(dynamic)? ack,
  }) {
    socket?.emitWithAck(
      "send_message",
      {
        "roomId": roomId,
        if (content != null) "content": content,
        if (mediaIds != null) "mediaIds": mediaIds,
      },
      ack: ack,
    );
  }

  void startTyping(String roomId) {
    socket?.emit("start_typing", {"roomId": roomId});
  }

  void stopTyping(String roomId) {
    socket?.emit("stop_typing", {"roomId": roomId});
  }

  void markDelivered(String messageId) {
    socket?.emit("message_delivered", messageId);
  }

  void markSeen(String messageId) {
    socket?.emit("message_seen", messageId);
  }

  void disconnect() {
    socket?.disconnect();
    socket?.dispose();
  }
}
```

---

## 9. Socket events

### Flutter → Server

| Event | Payload |
|-------|---------|
| `join_chat` | `"ROOM_UUID"` |
| `leave_chat` | `"ROOM_UUID"` |
| `send_message` | `{ roomId, content?, mediaIds? }` |
| `edit_message` | `{ messageId, content }` |
| `delete_message` | `{ messageId }` |
| `message_seen` | `"MESSAGE_UUID"` |
| `message_delivered` | `"MESSAGE_UUID"` |
| `start_typing` | `{ roomId }` |
| `stop_typing` | `{ roomId }` |

### Server → Flutter

| Event | Kab |
|-------|-----|
| `receive_message` | Naya message |
| `message_edited` | Edit hua |
| `message_deleted` | Delete hua `{ messageId }` |
| `message_seen` | `{ messageId, userId, read_at }` |
| `message_delivered` | `{ messageId, delivered_at }` |
| `room_seen` | Room seen |
| `start_typing` / `stop_typing` | `{ roomId, userId }` |
| `user_online` / `user_offline` | `{ userId }` |
| `get_online_users` | Online user IDs list |
| `new_chat` | Naya room |
| `room_updated` | Group update |

---

## 10. Message object

```json
{
  "id": "uuid",
  "room_id": "uuid",
  "sender_id": "V20230621TeDAzf6TeqE",
  "content": "Hello",
  "created_at": "2026-08-17T10:00:00.000Z",
  "updated_at": null,
  "deleted_at": null,
  "is_delivered": false,
  "delivered_at": null,
  "attachments": [
    {
      "id": "media-uuid",
      "file_name": "photo.jpg",
      "mime_type": "image/jpeg",
      "media_type": "image",
      "file_size": 12345,
      "url": "https://chatapizoe.techwagger.com/uploads/..."
    }
  ],
  "reads": []
}
```

UI rule:

- `sender_id == myUserId` → right bubble (sent)
- otherwise → left bubble (received)

---

## 11. Pura Flutter chat flow (step by step)

### Step 1 — Users list

```dart
final api = ChatApi(userId: currentUserId, userType: "VOL");
final users = await api.getUsers();
```

List tile pe tap → Step 2.

### Step 2 — Room banao / kholo

```dart
final room = await api.createDirectRoom(otherUserId);
final roomId = room["id"] as String;
```

Same 2 users ke liye existing DM return hota hai, naya duplicate nahi banta.

### Step 3 — Old messages REST se

```dart
final messages = await api.getMessages(roomId, limit: 20);
```

Pehle REST se list bharo, phir socket se live add karo.

### Step 4 — Socket connect + join

```dart
final chatSocket = ChatSocket(userId: currentUserId, userType: "VOL");

chatSocket.connect(
  onReceiveMessage: (msg) {
    // list me add karo
    // agar sender main nahi ho to:
    chatSocket.markDelivered(msg["id"]);
    chatSocket.markSeen(msg["id"]);
  },
);

chatSocket.joinRoom(roomId);
await api.markRoomSeen(roomId);
```

### Step 5 — Text bhejo

```dart
chatSocket.sendMessage(
  roomId: roomId,
  content: "Hello from Flutter",
  ack: (saved) {
    // optimistic UI replace with saved message
  },
);
```

REST se bhi bhej sakte ho (`POST /messages`) — dono tarike receiver ko `receive_message` denge. Live chat ke liye **socket prefer** karo.

### Step 6 — File / image bhejo

```dart
final uploaded = await api.uploadFile(
  filePath: pickedFile.path,
  fileName: pickedFile.name,
  mediaType: "image",
);

final mediaId = uploaded["data"]["mediaId"];

chatSocket.sendMessage(
  roomId: roomId,
  mediaIds: [mediaId],
);
```

`mediaType`: `image` | `video` | `audio` | `document` | `file`

Max size: **25 MB**. Field name must be **`file`**.

### Step 7 — Typing

```dart
onChanged: (text) {
  if (text.isNotEmpty) {
    chatSocket.startTyping(roomId);
  } else {
    chatSocket.stopTyping(roomId);
  }
}
```

### Step 8 — Screen band

```dart
@override
void dispose() {
  chatSocket.leaveRoom(roomId);
  chatSocket.disconnect();
  super.dispose();
}
```

---

## 12. Conversation list screen

```dart
final rooms = await api.getConversations();
```

Har room me milta hai:

- `id`, `name`, `is_group`, `group_image`
- `participants`
- `messages` → last message
- `unreadCount`

Sort already server pe latest message ke hisaab se hai.

Tap room → Chat screen + `join_chat(roomId)`.

---

## 13. Android / iOS permission

**Android** `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

Release build me cleartext ki zaroorat nahi — API **HTTPS** pe hai.

---

## 14. Quick test (Postman / curl)

Health:

```bash
curl https://chatapizoe.techwagger.com/health
```

Users:

```bash
curl https://chatapizoe.techwagger.com/api/chat/users \
  -H "x-user-id: V20230621TeDAzf6TeqE" \
  -H "x-user-type: VOL"
```

Create DM:

```bash
curl -X POST https://chatapizoe.techwagger.com/api/chat/rooms \
  -H "Content-Type: application/json" \
  -H "x-user-id: V20230621TeDAzf6TeqE" \
  -H "x-user-type: VOL" \
  -d "{\"recipientId\":\"OTHER_USER_ID\"}"
```

---

## 15. Common mistakes

| Problem | Fix |
|---------|-----|
| 401 Unauthorized | `x-user-id` header missing |
| Socket connect fail | `auth.userId` pass karo, transport `websocket` |
| Message nahi mil raha | `join_chat(roomId)` pehle karo |
| File upload fail | field name `file` hona chahiye, size ≤ 25MB |
| Duplicate DM rooms | `POST /rooms` with `recipientId` — server existing room dega |
| Image URL nahi khul rahi | `attachments[].url` use karo, full URL aati hai |

---

## 16. Suggested Flutter files

```text
lib/
├── chat/
│   ├── chat_config.dart
│   ├── chat_api.dart
│   ├── chat_socket.dart
│   ├── models/
│   │   ├── chat_message.dart
│   │   └── chat_room.dart
│   └── screens/
│       ├── conversation_list_screen.dart
│       ├── user_list_screen.dart
│       └── chat_screen.dart
```

---

**Live base URL:** https://chatapizoe.techwagger.com  
**REST:** https://chatapizoe.techwagger.com/api/chat  
**Socket:** wss://chatapizoe.techwagger.com
