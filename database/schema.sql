-- ZOE Chat Database Schema
-- Run: mysql -u <user> -p < database/schema.sql

CREATE DATABASE IF NOT EXISTS techwagger_zoe_chat
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE techwagger_zoe_chat;

CREATE TABLE IF NOT EXISTS chat_rooms (
  room_id       CHAR(36)     NOT NULL PRIMARY KEY,
  name          VARCHAR(100) NULL,
  group_image   VARCHAR(500) NULL,
  is_group      TINYINT(1)   NOT NULL DEFAULT 0,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  deleted_at    TIMESTAMP    NULL DEFAULT NULL,
  created_by    VARCHAR(100) NULL,
  INDEX idx_chat_rooms_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_participants (
  participant_id CHAR(36)    NOT NULL PRIMARY KEY,
  room_id        CHAR(36)    NOT NULL,
  user_id        VARCHAR(100) NOT NULL,
  joined_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  left_at        TIMESTAMP   NULL DEFAULT NULL,
  role           VARCHAR(20) NOT NULL DEFAULT 'MEMBER',
  INDEX idx_participants_room (room_id),
  INDEX idx_participants_user (user_id),
  INDEX idx_participants_room_user (room_id, user_id),
  CONSTRAINT fk_participants_room FOREIGN KEY (room_id)
    REFERENCES chat_rooms (room_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_messages (
  message_id    CHAR(36)     NOT NULL PRIMARY KEY,
  room_id       CHAR(36)     NOT NULL,
  sender_id     VARCHAR(100) NOT NULL,
  content       TEXT         NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NULL DEFAULT NULL,
  deleted_at    TIMESTAMP    NULL DEFAULT NULL,
  is_delivered  TINYINT(1)   NOT NULL DEFAULT 0,
  delivered_at  TIMESTAMP    NULL DEFAULT NULL,
  INDEX idx_messages_room (room_id),
  INDEX idx_messages_room_created (room_id, created_at),
  INDEX idx_messages_sender (sender_id),
  CONSTRAINT fk_messages_room FOREIGN KEY (room_id)
    REFERENCES chat_rooms (room_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media_uploads (
  media_id    CHAR(36)     NOT NULL PRIMARY KEY,
  user_id     VARCHAR(100) NULL,
  file_path   VARCHAR(500) NOT NULL,
  file_name   VARCHAR(255) NULL,
  mime_type   VARCHAR(100) NULL,
  media_type  VARCHAR(50)  NULL,
  file_size   INT          NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at  TIMESTAMP    NULL DEFAULT NULL,
  INDEX idx_media_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS message_media (
  message_media_id CHAR(36) NOT NULL PRIMARY KEY,
  message_id       CHAR(36) NOT NULL,
  media_id         CHAR(36) NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_message_media_message (message_id),
  CONSTRAINT fk_message_media_message FOREIGN KEY (message_id)
    REFERENCES chat_messages (message_id) ON DELETE CASCADE,
  CONSTRAINT fk_message_media_media FOREIGN KEY (media_id)
    REFERENCES media_uploads (media_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS message_reads (
  read_id     CHAR(36)     NOT NULL PRIMARY KEY,
  message_id  CHAR(36)     NOT NULL,
  user_id     VARCHAR(100) NOT NULL,
  read_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_message_reads (message_id, user_id),
  INDEX idx_reads_user (user_id),
  CONSTRAINT fk_reads_message FOREIGN KEY (message_id)
    REFERENCES chat_messages (message_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_public_keys (
  key_id      CHAR(36)     NOT NULL PRIMARY KEY,
  user_id     VARCHAR(100) NOT NULL,
  public_key  TEXT         NOT NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_public_keys_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
