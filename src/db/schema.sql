﻿﻿﻿-- =============================================
-- 随心想 (Moment Wall) — D1 Database Schema
-- =============================================

-- 1. 用户表：Device ID 优先识别，IP 降级兼容
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id   TEXT    UNIQUE,                           -- 设备ID（优先使用）
  ip_address  TEXT,                                      -- IP地址（降级兼容）
  nickname    TEXT    NOT NULL,                          -- 昵称（随机生成）
  avatar_color TEXT   NOT NULL DEFAULT "#E0F7FA",
  avatar_seed TEXT,
  location    TEXT    NOT NULL DEFAULT "来自广州",
  is_banned   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_device ON users(device_id);
CREATE INDEX IF NOT EXISTS idx_users_ip ON users(ip_address);

-- 2. 动态表
CREATE TABLE IF NOT EXISTS moments (
  id          TEXT    PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  content     TEXT    NOT NULL,
  image_url   TEXT,
  location    TEXT    NOT NULL DEFAULT "来自广州",
  likes       INTEGER NOT NULL DEFAULT 0,
  is_official INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_moments_created ON moments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moments_user    ON moments(user_id);

-- 3. 点赞关系表（唯一约束保证一人一赞）
CREATE TABLE IF NOT EXISTS likes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  moment_id  TEXT    NOT NULL,
  user_id    INTEGER NOT NULL,
  created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(moment_id, user_id),
  FOREIGN KEY (moment_id) REFERENCES moments(id),
  FOREIGN KEY (user_id)   REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_likes_moment ON likes(moment_id);
CREATE INDEX IF NOT EXISTS idx_likes_user   ON likes(user_id);

-- 4. 媒体文件表（预留视频扩展）
CREATE TABLE IF NOT EXISTS media (
  id               TEXT    PRIMARY KEY,
  user_id          INTEGER NOT NULL,
  media_type       TEXT    NOT NULL CHECK(media_type IN ("image", "video")),
  original_name    TEXT,
  storage_url      TEXT    NOT NULL,
  storage_path     TEXT    NOT NULL,
  storage_provider TEXT    NOT NULL DEFAULT "aliyun",
  file_size        INTEGER,
  mime_type        TEXT,
  width            INTEGER,
  height           INTEGER,
  duration         INTEGER,
  created_at       TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_media_user ON media(user_id);

-- 5. 种子数据：官方机器人账号 + 初始欢迎动态
INSERT OR IGNORE INTO users (id, ip_address, nickname, avatar_color, location)
VALUES (1, "system", "MomentBot", "#E8E7F1", "来自云端");

INSERT OR IGNORE INTO moments (id, user_id, content, location, likes, is_official, created_at)
VALUES 
  ("mom_welcome", 1, "欢迎来到随心想。在这里，你可以随意倾诉。每一条瞬间都会在 24 小时后隐去。", "来自云端", 112, 1, CURRENT_TIMESTAMP),
  ("mom_sample_01", 1, "深夜吐槽，KPI 真是要把人搞疯。", "来自上海", 5, 0, CURRENT_TIMESTAMP);
