-- =============================================
-- 数据库迁移脚本 v2 → v3
-- 添加 initial_nickname 字段，保存用户首次注册时的昵称
-- =============================================

-- 1. 添加 initial_nickname 字段
ALTER TABLE users ADD COLUMN initial_nickname TEXT;

-- 2. 将现有用户的昵称同步到 initial_nickname（对于已有用户，当前昵称即视为初始昵称）
UPDATE users SET initial_nickname = nickname WHERE initial_nickname IS NULL;

-- 3. 验证迁移
SELECT 'Migration 002 completed successfully!' as status;
SELECT COUNT(*) as total_users, COUNT(initial_nickname) as has_initial_nickname FROM users;