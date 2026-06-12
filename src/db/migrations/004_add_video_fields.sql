-- =============================================
-- 数据库迁移脚本 v4 → v5
-- moments 表新增 video 和 video_poster 字段
-- =============================================

-- 1. 添加 video 字段
ALTER TABLE moments ADD COLUMN video TEXT DEFAULT NULL;

-- 2. 添加 video_poster 字段
ALTER TABLE moments ADD COLUMN video_poster TEXT DEFAULT NULL;

-- 3. 验证
SELECT 'Migration 004 completed successfully!' as status;
SELECT id, video IS NOT NULL as has_video FROM moments;