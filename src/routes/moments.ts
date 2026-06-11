import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { generateMomentId } from "../utils/ip"

const router = new Hono<{ Bindings: { DB: D1Database }; Variables: { userId: number } }>()

// GET /api/moments
router.get("/", async (c) => {
  const userId = c.get("userId")
  const db = c.env.DB
  const cursor = c.req.query("cursor")
  const limit = Math.min(Number(c.req.query("limit")) || 20, 50)
  const params: any[] = [userId]

  let sql = "SELECT m.id, m.content, m.image_url, m.location, m.likes, m.created_at, m.is_official, u.nickname AS author, u.avatar_color AS avatar_bg, CASE WHEN l.id IS NOT NULL THEN 1 ELSE 0 END AS has_liked, CASE WHEN m.user_id = ?1 THEN 1 ELSE 0 END AS is_mine FROM moments m JOIN users u ON m.user_id = u.id LEFT JOIN likes l ON l.moment_id = m.id AND l.user_id = ?1"

  if (cursor) { sql += " AND m.id < ?2"; params.push(cursor) }
  sql += " ORDER BY m.created_at DESC LIMIT ?" + (params.length + 1)
  params.push(limit)

  const { results } = await db.prepare(sql).bind(...params).all<any>()
  const moments = results.map((r: any) => ({
    id: r.id, author: r.author, avatarText: r.author.charAt(0), avatarBg: r.avatar_bg,
    content: r.content, image: r.image_url || undefined, image_url: r.image_url || undefined,
    timestamp: formatTimeAgo(r.created_at),
    createdAt: new Date(r.created_at + "Z").getTime(),
    location: r.location, likes: r.likes,
    hasLiked: r.has_liked === 1, isMine: r.is_mine === 1, isOfficial: r.is_official === 1,
  }))
  return c.json({ success: true, data: moments })
})

// POST /api/moments
const publishSchema = z.object({ content: z.string().min(1).max(280), imageUrl: z.string().optional(), location: z.string().optional() })
router.post("/", zValidator("json", publishSchema), async (c) => {
  const userId = c.get("userId"); const db = c.env.DB
  const { content, imageUrl, location } = c.req.valid("json")
  const id = generateMomentId(); const loc = location || "来自广州"
  await db.prepare("INSERT INTO moments (id, user_id, content, image_url, location) VALUES (?, ?, ?, ?, ?)").bind(id, userId, content, imageUrl || null, loc).run()
  const user = await db.prepare("SELECT nickname, avatar_color FROM users WHERE id = ?").bind(userId).first<{ nickname: string; avatar_color: string }>()
  return c.json({ success: true, data: { id, author: user?.nickname + " (你)", avatarText: user?.nickname?.charAt(0) || "路", avatarBg: user?.avatar_color || "#E0F7FA", content, image: imageUrl || undefined, image_url: imageUrl || undefined, timestamp: "刚刚", createdAt: Date.now(), location: loc, likes: 0, hasLiked: false, isMine: true, isOfficial: false } }, 201)
})

// DELETE /api/moments/:id
router.delete("/:id", async (c) => {
  const userId = c.get("userId"); const db = c.env.DB; const id = c.req.param("id")
  const moment = await db.prepare("SELECT user_id FROM moments WHERE id = ?").bind(id).first<{ user_id: number }>()
  if (!moment) return c.json({ success: false, error: "动态不存在" }, 404)
  if (moment.user_id !== userId) return c.json({ success: false, error: "只能删除自己的动态" }, 403)
  await db.prepare("DELETE FROM likes WHERE moment_id = ?").bind(id).run()
  await db.prepare("DELETE FROM moments WHERE id = ?").bind(id).run()
  return c.json({ success: true, data: { id } })
})

// POST /api/moments/:id/like
router.post("/:id/like", async (c) => {
  const userId = c.get("userId"); const db = c.env.DB; const momentId = c.req.param("id")
  const existing = await db.prepare("SELECT id FROM likes WHERE moment_id = ? AND user_id = ?").bind(momentId, userId).first()
  if (existing) {
    await db.prepare("DELETE FROM likes WHERE moment_id = ? AND user_id = ?").bind(momentId, userId).run()
    await db.prepare("UPDATE moments SET likes = likes - 1 WHERE id = ? AND likes > 0").bind(momentId).run()
    const m = await db.prepare("SELECT likes FROM moments WHERE id = ?").bind(momentId).first<{ likes: number }>()
    return c.json({ success: true, data: { hasLiked: false, likes: m?.likes || 0 } })
  } else {
    await db.prepare("INSERT INTO likes (moment_id, user_id) VALUES (?, ?)").bind(momentId, userId).run()
    await db.prepare("UPDATE moments SET likes = likes + 1 WHERE id = ?").bind(momentId).run()
    const m = await db.prepare("SELECT likes FROM moments WHERE id = ?").bind(momentId).first<{ likes: number }>()
    return c.json({ success: true, data: { hasLiked: true, likes: m?.likes || 0 } })
  }
})

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr + "Z").getTime()
  if (diff < 60000) return "刚刚"
  if (diff < 3600000) return Math.floor(diff / 60000) + "分钟前"
  if (diff < 86400000) return Math.floor(diff / 3600000) + "小时前"
  return Math.floor(diff / 86400000) + "天前"
}

export { router as momentsRoutes }
