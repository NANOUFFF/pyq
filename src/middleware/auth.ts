import { Context, Next } from "hono"
import { extractClientIP } from "../utils/ip"

function generateNickname(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `${timestamp}${random}`
}

export async function authMiddleware(c: Context, next: Next) {
  const db = c.env.DB
  
  let deviceId = c.req.header("X-Device-ID")
  const ip = extractClientIP(c.req.raw)
  
  c.set("ipAddress", ip)
  
  let userId: number
  
  if (deviceId) {
    const deviceUser = await db
      .prepare("SELECT id FROM users WHERE device_id = ?")
      .bind(deviceId)
      .first<{ id: number }>()
    
    if (deviceUser) {
      userId = deviceUser.id
    } else {
      const nickname = generateNickname()
      try {
        const result = await db
          .prepare("INSERT INTO users (device_id, ip_address, nickname, initial_nickname) VALUES (?, ?, ?, ?)")
          .bind(deviceId, ip, nickname, nickname)
          .run()
        userId = Number(result.meta.last_row_id)
      } catch {
        try {
          const result = await db
            .prepare("INSERT INTO users (device_id, nickname, initial_nickname) VALUES (?, ?, ?)")
            .bind(deviceId, nickname, nickname)
            .run()
          userId = Number(result.meta.last_row_id)
        } catch {
          deviceId = null
        }
      }
    }
  }
  
  // 如果 deviceId 没匹配到用户，尝试通过 IP 找回原有账号
  // 同时把当前 deviceId 回写，防止下次又找不到
  if ((!deviceId || !userId!) && ip) {
    const ipUser = await db
      .prepare("SELECT id, device_id FROM users WHERE ip_address = ?")
      .bind(ip)
      .first<{ id: number; device_id: string | null }>()
    
    if (ipUser) {
      userId = ipUser.id
      // 把当前 deviceId 写回数据库，下次即使清 localStorage 也能直接匹配
      if (deviceId && ipUser.device_id !== deviceId) {
        await db.prepare("UPDATE users SET device_id = ? WHERE id = ?").bind(deviceId, ipUser.id).run()
      }
    } else {
      // 完全的新用户
      const nickname = generateNickname()
      const result = await db
        .prepare("INSERT INTO users (ip_address, nickname, initial_nickname" + (deviceId ? ", device_id" : "") + ") VALUES (?, ?, ?" + (deviceId ? ", ?" : "") + ")")
        .bind(ip, nickname, nickname, ...(deviceId ? [deviceId] : []))
        .run()
      userId = Number(result.meta.last_row_id)
    }
  }
  
  c.set("userId", userId)
  await next()
}
