-- =============================================
-- 数据库迁移脚本 v1 → v2
-- 添加 Device ID 支持 + 随机昵称
-- =============================================

-- 1. 添加 device_id 字段
ALTER TABLE users ADD COLUMN device_id TEXT UNIQUE;

-- 2. 创建 device_id 索引
CREATE INDEX IF NOT EXISTS idx_users_device ON users(device_id);

-- 3. 将现有的默认昵称更新为随机昵称
-- 注意：这个脚本只执行一次，现有用户的昵称保持不变
-- 如果想为所有现有用户生成新昵称，可以取消下面的注释
-- UPDATE users SET nickname = 
--   (SELECT 
--      (SELECT value FROM (VALUES ('开心的'), ('焦虑的'), ('迷茫的'), ('兴奋的'), ('疲惫的'), ('悠闲的'), ('忙碌的'), ('伤心的'), ('乐观的'), ('浪漫的') ORDER BY RANDOM() LIMIT 1)
--      || 
--      (SELECT value FROM (VALUES ('上班族'), ('学生党'), ('程序员'), ('设计师'), ('打工人'), ('创业者'), ('自由职业者'), ('考研人'), ('加班狗'), ('摸鱼大师'), ('夜猫子'), ('早起鸟') ORDER BY RANDOM() LIMIT 1)
--   )
-- WHERE id > 1;  -- 保留官方机器人账号的昵称

-- 4. 验证迁移
SELECT 'Migration completed successfully!' as status;
SELECT COUNT(*) as user_count, COUNT(device_id) as device_id_count FROM users;
