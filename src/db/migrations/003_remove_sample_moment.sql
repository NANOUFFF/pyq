-- =============================================
-- 数据库迁移脚本 v3 → v4
-- 删除示例动态 "mom_sample_01"，只保留官方欢迎动态
-- =============================================

-- 1. 删除示例动态的评论回复
DELETE FROM comment_replies WHERE comment_id IN (SELECT id FROM comments WHERE moment_id = 'mom_sample_01');

-- 2. 删除示例动态的评论
DELETE FROM comments WHERE moment_id = 'mom_sample_01';

-- 3. 删除示例动态的点赞
DELETE FROM likes WHERE moment_id = 'mom_sample_01';

-- 4. 删除示例动态
DELETE FROM moments WHERE id = 'mom_sample_01';

-- 5. 验证
SELECT 'Migration 003 completed successfully!' as status;
SELECT id, content FROM moments WHERE is_official = 1;