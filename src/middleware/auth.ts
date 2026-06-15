import { Context, Next } from "hono"
import { extractClientIP } from "../utils/ip"

function generateNickname(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `${timestamp}${random}`
}

// 验证账号格式：手机号或邮箱
export function isValidAccount(val: string): boolean {
  // 手机号：1开头的11位数字
  const phoneRe = /^1\d{10}$/
  // 邮箱：基础邮箱格式
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return phoneRe.test(val) || emailRe.test(val)
}

export async function authMiddleware(c: Context, next: Next) {
  const db = c.env.DB

  const account = c.req.header("X-Account")        // 最高优先级：手机号/邮箱
  const deviceId = c.req.header("X-Device-ID")     // 次优先级：设备ID
  const ip = extractClientIP(c.req.raw)             // 仅用于新用户记录，不用与匹配

  c.set("ipAddress", ip)

  let userId: number | undefined

  // ─── 第一优先级：通过 Account 精确匹配 ───
  if (account && isValidAccount(account)) {
    const accountUser = await db
      .prepare("SELECT id FROM users WHERE account = ?")
      .bind(account)
      .first<{ id: number }>()

    if (accountUser) {
      userId = accountUser.id
      // 如果带了 deviceId，同步绑定到该用户（方便同设备下次用 deviceId 匹配）
      if (deviceId) {
        // 先清除其他用户对该 device_id 的占用（避免 UNIQUE 约束冲突）
        await db.prepare("UPDATE users SET device_id = NULL WHERE device_id = ? AND id != ?")
          .bind(deviceId, userId).run()
        // 再绑定到当前用户
        await db.prepare("UPDATE users SET device_id = ? WHERE id = ? AND (device_id IS NULL OR device_id != ?)")
          .bind(deviceId, userId, deviceId).run()
      }
    }
  }

  // ─── 第二优先级：通过 Device ID 匹配（仅当有 deviceId 且第一优先级未找到时）───
  if (!userId && deviceId) {
    const deviceUser = await db
      .prepare("SELECT id FROM users WHERE device_id = ?")
      .bind(deviceId)
      .first<{ id: number }>()

    if (deviceUser) {
      userId = deviceUser.id
    }
  }

  // ─── 都找不到 → 创建新用户（但不为 /api/users/login 创建，让 login handler 自行处理）───
  if (!userId) {
    const url = new URL(c.req.url)
    // 如果是 login 请求，不做自动创建用户，让 login handler 来识别
    if (url.pathname === "/api/users/login") {
      // login 路由：设置 userId 为 undefined，但不要创建新用户
      // login handler 会自己查询 account 并返回正确的用户信息
      c.set("userId", 0) // 设为 0 表示未认证，login handler 应忽略此值
      await next()
      return
    }

    const nickname = generateNickname()
    if (deviceId) {
      try {
        const result = await db.prepare("INSERT INTO users (device_id, ip_address, nickname, initial_nickname) VALUES (?, ?, ?, ?)")
          .bind(deviceId, ip, nickname, nickname).run()
        userId = Number(result.meta.last_row_id)
      } catch {
        const result = await db.prepare("INSERT INTO users (device_id, nickname, initial_nickname) VALUES (?, ?, ?)")
          .bind(deviceId, nickname, nickname).run()
        userId = Number(result.meta.last_row_id)
      }
    } else {
      const result = await db.prepare("INSERT INTO users (ip_address, nickname, initial_nickname) VALUES (?, ?, ?)")
        .bind(ip, nickname, nickname).run()
      userId = Number(result.meta.last_row_id)
    }
  }

  c.set("userId", userId)
  await next()
}