-- =============================================
-- 数据库迁移脚本 v3 → v4
-- 清空所有用户数据，只保留一条官方欢迎动态
-- =============================================

-- 1. 删除所有评论回复
DELETE FROM comment_replies;

-- 2. 删除所有评论
DELETE FROM comments;

-- 3. 删除所有点赞
DELETE FROM likes;

-- 4. 删除所有非官方动态（只保留 mom_welcome）
DELETE FROM moments WHERE id != 'mom_welcome';

-- 5. 删除所有用户（只保留 id=1 的官方机器人）
DELETE FROM users WHERE id != 1;

-- 6. 验证
SELECT 'Migration 003 completed! Only official data remains.' as status;
SELECT id, content FROM moments;
SELECT id, nickname FROM users;