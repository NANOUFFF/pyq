import { Hono } from "hono"

const router = new Hono<{ Bindings: { DB: D1Database; ADMIN_TOKEN?: string }; Variables: { userId: number } }>()

// 简单的 Admin Token 验证中间件
async function adminAuth(c: any, next: any) {
  const adminToken = c.env.ADMIN_TOKEN
  if (!adminToken) {
    return c.json({ success: false, error: "未配置管理员权限" }, 500)
  }

  const token = c.req.header("X-Admin-Token")
  if (!token || token !== adminToken) {
    return c.json({ success: false, error: "管理员身份验证失败" }, 401)
  }

  await next()
}

router.use("*", adminAuth)

// ==================== 仪表盘统计 ====================

// GET /api/admin/dashboard - 获取统计数据
router.get("/dashboard", async (c) => {
  const db = c.env.DB

  const [userCount, momentCount, commentCount, todayMoments, bannedUsers] = await Promise.all([
    db.prepare("SELECT COUNT(*) as count FROM users").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) as count FROM moments").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) as count FROM comments").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) as count FROM moments WHERE date(created_at) = date('now')").first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) as count FROM users WHERE is_banned = 1").first<{ count: number }>(),
  ])

  return c.json({
    success: true,
    data: {
      totalUsers: userCount?.count || 0,
      totalMoments: momentCount?.count || 0,
      totalComments: commentCount?.count || 0,
      todayMoments: todayMoments?.count || 0,
      bannedUsers: bannedUsers?.count || 0,
    }
  })
})

// ==================== 用户管理 ====================

// GET /api/admin/users - 用户列表
router.get("/users", async (c) => {
  const db = c.env.DB
  const page = Math.max(1, Number(c.req.query("page")) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(c.req.query("pageSize")) || 20))
  const offset = (page - 1) * pageSize
  const keyword = c.req.query("keyword") || ""

  let countSql = "SELECT COUNT(*) as count FROM users"
  let listSql = "SELECT id, account, nickname, location, ip_address, device_id, is_banned, created_at, updated_at FROM users"
  const params: any[] = []

  if (keyword) {
    const like = `%${keyword}%`
    countSql += " WHERE id LIKE ? OR nickname LIKE ? OR account LIKE ? OR ip_address LIKE ?"
    listSql += " WHERE id LIKE ? OR nickname LIKE ? OR account LIKE ? OR ip_address LIKE ?"
    params.push(like, like, like, like)
  }

  listSql += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
  params.push(pageSize, offset)

  const [countResult, { results }] = await Promise.all([
    db.prepare(countSql).bind(...(keyword ? [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`] : [])).first<{ count: number }>(),
    db.prepare(listSql).bind(...params).all<any>(),
  ])

  const total = countResult?.count || 0

  return c.json({
    success: true,
    data: {
      list: results.map((u: any) => ({
        id: u.id,
        account: u.account || undefined,
        nickname: u.nickname,
        location: u.location,
        ipAddress: u.ip_address,
        deviceId: u.device_id,
        isBanned: u.is_banned === 1,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      }
    }
  })
})

// GET /api/admin/users/:id - 用户详情
router.get("/users/:id", async (c) => {
  const db = c.env.DB
  const id = c.req.param("id")

  const user = await db.prepare(
    "SELECT id, account, nickname, avatar_color, avatar_seed, location, ip_address, device_id, is_banned, initial_nickname, created_at, updated_at FROM users WHERE id = ?"
  ).bind(id).first<any>()

  if (!user) return c.json({ success: false, error: "用户不存在" }, 404)

  // 查询该用户的动态数、评论数、点赞数
  const [momentCount, commentCount, likeCount] = await Promise.all([
    db.prepare("SELECT COUNT(*) as count FROM moments WHERE user_id = ?").bind(id).first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) as count FROM comments WHERE user_id = ?").bind(id).first<{ count: number }>(),
    db.prepare("SELECT COUNT(*) as count FROM likes WHERE user_id = ?").bind(id).first<{ count: number }>(),
  ])

  return c.json({
    success: true,
    data: {
      id: user.id,
      account: user.account || undefined,
      nickname: user.nickname,
      initialNickname: user.initial_nickname,
      avatarColor: user.avatar_color,
      avatarSeed: user.avatar_seed || "",
      location: user.location,
      ipAddress: user.ip_address,
      deviceId: user.device_id,
      isBanned: user.is_banned === 1,
      stats: {
        moments: momentCount?.count || 0,
        comments: commentCount?.count || 0,
        likes: likeCount?.count || 0,
      },
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    }
  })
})

// PUT /api/admin/users/:id/ban - 封禁/解封用户
router.put("/users/:id/ban", async (c) => {
  const db = c.env.DB
  const id = c.req.param("id")

  const user = await db.prepare("SELECT id, is_banned FROM users WHERE id = ?").bind(id).first<{ id: number; is_banned: number }>()
  if (!user) return c.json({ success: false, error: "用户不存在" }, 404)

  const newStatus = user.is_banned === 1 ? 0 : 1
  await db.prepare("UPDATE users SET is_banned = ?, updated_at = datetime('now') WHERE id = ?").bind(newStatus, id).run()

  return c.json({
    success: true,
    data: {
      id: Number(id),
      isBanned: newStatus === 1,
      message: newStatus === 1 ? "用户已封禁" : "用户已解封"
    }
  })
})

// DELETE /api/admin/users/:id - 删除用户及其所有数据
router.delete("/users/:id", async (c) => {
  const db = c.env.DB
  const id = Number(c.req.param("id"))

  if (id === 1) return c.json({ success: false, error: "不能删除系统管理员" }, 403)

  // 获取用户的所有动态ID
  const moments = await db.prepare("SELECT id FROM moments WHERE user_id = ?").bind(id).all<any>()
  const momentIds = moments.results.map((m: any) => m.id)

  if (momentIds.length > 0) {
    const comments = await db.prepare(`SELECT id FROM comments WHERE moment_id IN (${momentIds.map(() => "?").join(",")})`).bind(...momentIds).all<any>()
    const commentIds = comments.results.map((c: any) => c.id)

    if (commentIds.length > 0) {
      await db.prepare(`DELETE FROM comment_replies WHERE comment_id IN (${commentIds.map(() => "?").join(",")})`).bind(...commentIds).run()
    }
    await db.prepare(`DELETE FROM comments WHERE moment_id IN (${momentIds.map(() => "?").join(",")})`).bind(...momentIds).run()
    await db.prepare(`DELETE FROM likes WHERE moment_id IN (${momentIds.map(() => "?").join(",")})`).bind(...momentIds).run()
    await db.prepare(`DELETE FROM moments WHERE id IN (${momentIds.map(() => "?").join(",")})`).bind(...momentIds).run()
  }

  // 删除用户的评论/点赞/媒体
  await db.prepare("DELETE FROM comments WHERE user_id = ?").bind(id).run()
  await db.prepare("DELETE FROM comment_replies WHERE user_id = ?").bind(id).run()
  await db.prepare("DELETE FROM likes WHERE user_id = ?").bind(id).run()
  await db.prepare("DELETE FROM media WHERE user_id = ?").bind(id).run()
  await db.prepare("DELETE FROM users WHERE id = ?").bind(id).run()

  return c.json({ success: true, data: { message: "用户及所有数据已删除" } })
})

// ==================== 动态管理 ====================

// GET /api/admin/moments - 动态列表
router.get("/moments", async (c) => {
  const db = c.env.DB
  const page = Math.max(1, Number(c.req.query("page")) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(c.req.query("pageSize")) || 20))
  const offset = (page - 1) * pageSize

  const countResult = await db.prepare("SELECT COUNT(*) as count FROM moments").first<{ count: number }>()
  const total = countResult?.count || 0

  const { results } = await db.prepare(
    `SELECT m.id, m.content, m.image_url, m.video, m.location, m.likes, m.is_official, m.created_at,
            u.nickname AS author, u.id AS user_id
     FROM moments m
     JOIN users u ON m.user_id = u.id
     ORDER BY m.created_at DESC LIMIT ? OFFSET ?`
  ).bind(pageSize, offset).all<any>()

  return c.json({
    success: true,
    data: {
      list: results.map((m: any) => ({
        id: m.id,
        content: m.content,
        imageUrl: m.image_url,
        video: m.video,
        location: m.location,
        likes: m.likes,
        isOfficial: m.is_official === 1,
        author: m.author,
        userId: m.user_id,
        createdAt: m.created_at,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      }
    }
  })
})

// GET /api/admin/moments/:id - 动态详情
router.get("/moments/:id", async (c) => {
  const db = c.env.DB
  const id = c.req.param("id")

  const moment = await db.prepare(
    `SELECT m.*, u.nickname AS author, u.account AS user_account
     FROM moments m JOIN users u ON m.user_id = u.id WHERE m.id = ?`
  ).bind(id).first<any>()

  if (!moment) return c.json({ success: false, error: "动态不存在" }, 404)

  // 获取评论
  const { results: comments } = await db.prepare(
    `SELECT c.id, c.content, c.created_at, u.nickname, u.id AS user_id
     FROM comments c JOIN users u ON c.user_id = u.id WHERE c.moment_id = ? ORDER BY c.created_at ASC`
  ).bind(id).all<any>()

  return c.json({
    success: true,
    data: {
      id: moment.id,
      content: moment.content,
      imageUrl: moment.image_url,
      video: moment.video,
      videoPoster: moment.video_poster,
      location: moment.location,
      likes: moment.likes,
      isOfficial: moment.is_official === 1,
      author: moment.author,
      userAccount: moment.user_account,
      userId: moment.user_id,
      createdAt: moment.created_at,
      comments: comments.map((c: any) => ({
        id: c.id,
        content: c.content,
        author: c.nickname,
        userId: c.user_id,
        createdAt: c.created_at,
      }))
    }
  })
})

// DELETE /api/admin/moments/:id - 删除动态
router.delete("/moments/:id", async (c) => {
  const db = c.env.DB
  const id = c.req.param("id")

  // 删除评论回复 → 评论 → 点赞 → 动态
  const comments = await db.prepare("SELECT id FROM comments WHERE moment_id = ?").bind(id).all<any>()
  const commentIds = comments.results.map((c: any) => c.id)
  if (commentIds.length > 0) {
    await db.prepare(`DELETE FROM comment_replies WHERE comment_id IN (${commentIds.map(() => "?").join(",")})`).bind(...commentIds).run()
  }
  await db.prepare("DELETE FROM comments WHERE moment_id = ?").bind(id).run()
  await db.prepare("DELETE FROM likes WHERE moment_id = ?").bind(id).run()
  await db.prepare("DELETE FROM moments WHERE id = ?").bind(id).run()

  return c.json({ success: true, data: { message: "动态已删除" } })
})

// ==================== 评论管理 ====================

// GET /api/admin/comments - 评论列表
router.get("/comments", async (c) => {
  const db = c.env.DB
  const page = Math.max(1, Number(c.req.query("page")) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(c.req.query("pageSize")) || 20))
  const offset = (page - 1) * pageSize

  const countResult = await db.prepare("SELECT COUNT(*) as count FROM comments").first<{ count: number }>()
  const total = countResult?.count || 0

  const { results } = await db.prepare(
    `SELECT c.id, c.content, c.created_at, c.moment_id,
            u.nickname AS author, u.id AS user_id
     FROM comments c JOIN users u ON c.user_id = u.id
     ORDER BY c.created_at DESC LIMIT ? OFFSET ?`
  ).bind(pageSize, offset).all<any>()

  return c.json({
    success: true,
    data: {
      list: results.map((c: any) => ({
        id: c.id,
        content: c.content,
        author: c.author,
        userId: c.user_id,
        momentId: c.moment_id,
        createdAt: c.created_at,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      }
    }
  })
})

// DELETE /api/admin/comments/:id - 删除评论
router.delete("/comments/:id", async (c) => {
  const db = c.env.DB
  const id = c.req.param("id")

  await db.prepare("DELETE FROM comment_replies WHERE comment_id = ?").bind(id).run()
  await db.prepare("DELETE FROM comments WHERE id = ?").bind(id).run()

  return c.json({ success: true, data: { message: "评论已删除" } })
})

export { router as adminRoutes }