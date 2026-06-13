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
  
  // 优先通过 deviceId 精确匹配
  if (deviceId) {
    const deviceUser = await db
      .prepare("SELECT id FROM users WHERE device_id = ?")
      .bind(deviceId)
      .first<{ id: number }>()
    
    if (deviceUser) {
      userId = deviceUser.id
    }
    // 注意：deviceId 不匹配时不要急着新建用户，先试试 IP 找回
  }
  
  // 如果 deviceId 没匹配到，尝试通过 IP 找回原有账号
  if (!userId!) {
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
    }
  }
  
  // 两种方式都找不到 → 创建新用户
  if (!userId!) {
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
