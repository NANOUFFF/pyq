import { Context, Next } from "hono"
import { extractClientIP } from "../utils/ip"

// 生成随机字符串作为昵称（8位）
function generateNickname(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export async function authMiddleware(c: Context, next: Next) {
  const db = c.env.DB
  
  const deviceId = c.req.header("X-Device-ID")
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
      try {
        const nickname = generateNickname()
        const result = await db
          .prepare("INSERT INTO users (device_id, ip_address, nickname) VALUES (?, ?, ?)")
          .bind(deviceId, ip, nickname)
          .run()
        userId = Number(result.meta.last_row_id)
      } catch {
        deviceId = null
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
