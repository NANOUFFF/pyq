import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const router = new Hono<{ Bindings: { DB: D1Database }; Variables: { userId: number; ipAddress: string } }>()

// GET /api/users/me
router.get("/me", async (c) => {
  const userId = c.get("userId"); const db = c.env.DB
  const user = await db.prepare("SELECT id, nickname, avatar_color, avatar_seed, location, ip_address FROM users WHERE id = ?").bind(userId).first<{
    id: number; nickname: string; avatar_color: string; avatar_seed: string; location: string; ip_address: string
  }>()
  if (!user) return c.json({ success: false, error: "用户不存在" }, 404)
  return c.json({
    success: true,
    data: formatUser(user)
  })
})

// PUT /api/users/nickname
const nicknameSchema = z.object({ nickname: z.string().min(1).max(10) })
router.put("/nickname", zValidator("json", nicknameSchema), async (c) => {
  const userId = c.get("userId"); const db = c.env.DB; const { nickname } = c.req.valid("json")

  let newColor = "#FFE4E1"
  let finalNickname = nickname

  // 如果是"重置昵称"操作（前端传入"路过的打工人"表示重置），则使用用户的初始昵称
  if (nickname === "路过的打工人") {
    const user = await db.prepare("SELECT initial_nickname FROM users WHERE id = ?").bind(userId).first<{ initial_nickname: string | null }>()
    finalNickname = user?.initial_nickname || nickname
    newColor = "#E0F7FA"
  }

  await db.prepare("UPDATE users SET nickname = ?, avatar_color = ?, updated_at = datetime('now') WHERE id = ?").bind(finalNickname, newColor, userId).run()
  const u = await db.prepare("SELECT id, nickname, avatar_color, avatar_seed, location, ip_address FROM users WHERE id = ?").bind(userId).first()
  return c.json({ success: true, data: formatUser(u) })
})

// PUT /api/users/avatar - 更新头像颜色与种子
const avatarSchema = z.object({
  color: z.string().min(4).max(7),
  seed: z.string().min(0).max(20).optional(),
})
router.put("/avatar", zValidator("json", avatarSchema), async (c) => {
  const userId = c.get("userId"); const db = c.env.DB
  const { color, seed } = c.req.valid("json")
  await db.prepare("UPDATE users SET avatar_color = ?, avatar_seed = ?, updated_at = datetime('now') WHERE id = ?").bind(color, seed || "", userId).run()
  const u = await db.prepare("SELECT id, nickname, avatar_color, avatar_seed, location, ip_address FROM users WHERE id = ?").bind(userId).first()
  return c.json({ success: true, data: formatUser(u) })
})

// DELETE /api/users/me/data - 删除当前用户的所有数据
router.delete("/me/data", async (c) => {
  const userId = c.get("userId")
  const db = c.env.DB

  // 获取用户的所有动态ID
  const moments = await db.prepare("SELECT id FROM moments WHERE user_id = ?").bind(userId).all<any>()
  const momentIds = moments.results.map((m: any) => m.id)

  // 如果有动态，先删除相关的评论回复、评论、点赞
  if (momentIds.length > 0) {
    // 获取所有评论ID
    const comments = await db.prepare(`SELECT id FROM comments WHERE moment_id IN (${momentIds.map(() => "?").join(",")})`).bind(...momentIds).all<any>()
    const commentIds = comments.results.map((c: any) => c.id)

    // 删除评论回复
    if (commentIds.length > 0) {
      await db.prepare(`DELETE FROM comment_replies WHERE comment_id IN (${commentIds.map(() => "?").join(",")})`).bind(...commentIds).run()
    }

    // 删除评论
    await db.prepare(`DELETE FROM comments WHERE moment_id IN (${momentIds.map(() => "?").join(",")})`).bind(...momentIds).run()

    // 删除点赞
    await db.prepare(`DELETE FROM likes WHERE moment_id IN (${momentIds.map(() => "?").join(",")})`).bind(...momentIds).run()

    // 删除动态
    await db.prepare(`DELETE FROM moments WHERE id IN (${momentIds.map(() => "?").join(",")})`).bind(...momentIds).run()
  }

  return c.json({ success: true, data: { message: "数据已清空" } })
})

function formatUser(u: any) {
  return {
    id: u.id,
    nickname: u.nickname,
    avatarColor: u.avatar_color,
    avatarSeed: u.avatar_seed || "",
    avatarText: u.nickname?.charAt(0) || "?",
    location: u.location,
    ipAddress: u.ip_address,
  }
}

export { router as usersRoutes }
