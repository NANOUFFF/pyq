-- =============================================
-- 删除 id >= 27 的所有用户及其关联数据
-- =============================================

-- 1. 先获取需要删除的用户创建的所有动态ID
-- 我们用临时表的方式来处理

-- 2. 从评论回复开始删除（用户参与的和相关动态的）
DELETE FROM comment_replies WHERE user_id >= 27;

-- 3. 删除用户的评论
DELETE FROM comments WHERE user_id >= 27;

-- 4. 删除用户的点赞
DELETE FROM likes WHERE user_id >= 27;

-- 5. 删除用户的媒体文件
DELETE FROM media WHERE user_id >= 27;

-- 6. 删除用户发布的动态（以及这些动态关联的评论/点赞/回复）
-- 先删除这些动态下的评论回复
DELETE FROM comment_replies WHERE comment_id IN (
  SELECT c.id FROM comments c 
  JOIN moments m ON c.moment_id = m.id 
  WHERE m.user_id >= 27
);

-- 再删除这些动态下的评论
DELETE FROM comments WHERE moment_id IN (
  SELECT id FROM moments WHERE user_id >= 27
);

-- 再删除这些动态的点赞
DELETE FROM likes WHERE moment_id IN (
  SELECT id FROM moments WHERE user_id >= 27
);

-- 最后删除这些动态
DELETE FROM moments WHERE user_id >= 27;

-- 7. 最后删除用户
DELETE FROM users WHERE id >= 27;

-- 8. 验证
SELECT 'Deleted users with id >= 27' as status;
SELECT COUNT(*) as remaining_users FROM users;
SELECT id, nickname FROM users;