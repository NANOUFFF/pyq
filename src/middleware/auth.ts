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
          .prepare("INSERT INTO users (device_id, ip_address, nickname) VALUES (?, ?, ?)")
          .bind(deviceId, ip, nickname)
          .run()
        userId = Number(result.meta.last_row_id)
      } catch {
        try {
          const result = await db
            .prepare("INSERT INTO users (device_id, nickname) VALUES (?, ?)")
            .bind(deviceId, nickname)
            .run()
          userId = Number(result.meta.last_row_id)
        } catch {
          deviceId = null
        }
      }
    }
  }
  
  if (!deviceId) {
    // 降级方案：使用 IP 地址（兼容性）
    const ipUser = await db
      .prepare("SELECT id FROM users WHERE ip_address = ?")
      .bind(ip)
      .first<{ id: number }>()
    
    if (ipUser) {
      userId = ipUser.id
    } else {
      // 新用户：创建账号，使用 UUID 前8位作为昵称
      const nickname = generateNickname()
      const result = await db
        .prepare("INSERT INTO users (ip_address, nickname) VALUES (?, ?)")
        .bind(ip, nickname)
        .run()
      userId = Number(result.meta.last_row_id)
    }
  }
  
  c.set("userId", userId)
  await next()
}
