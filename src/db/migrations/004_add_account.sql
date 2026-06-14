-- =============================================
-- 数据库迁移脚本 v4 → v5
-- 添加 account 字段（手机号/邮箱），作为最稳定的用户身份
-- 优先级：Account > Device ID > IP
-- =============================================

-- 1. 添加 account 字段（SQLite 不支持 ALTER TABLE 加 UNIQUE 列，所以不加约束）
ALTER TABLE users ADD COLUMN account TEXT;

-- 2. 创建 UNIQUE 索引来保证账号唯一性（允许多个 NULL）
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_account ON users(account);

-- 3. 验证迁移
SELECT 'Migration 004 completed successfully!' as status;
SELECT COUNT(*) as total_users, 
       COUNT(account) as has_account,
       COUNT(device_id) as has_device_id 
FROM users;
