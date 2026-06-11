-- =============================================
-- 随心想 — 数据库迁移: 新增 avatar_seed
-- =============================================
-- 用于 DiceBear 生成个性化头像
ALTER TABLE users ADD COLUMN avatar_seed TEXT DEFAULT "";
