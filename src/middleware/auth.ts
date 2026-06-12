import { Context, Next } from "hono"
import { extractClientIP } from "../utils/ip"

// 生成 UUID 格式的昵称（取前8位）
function generateNickname(): string {
  // 使用 crypto.randomUUID 或降级方案
  const uuid = crypto.randomUUID?.() || 
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
    })
  // 取前8位作为昵称，如 "a1b2c3d4"
  return uuid.slice(0, 8)
}

export async function authMiddleware(c: Context, next: Next) {
  const db = c.env.DB
  
  // 优先使用 Device ID 识别用户
  const deviceId = c.req.header("X-Device-ID")
  const ip = extractClientIP(c.req.raw)
  
  // 保存 IP 地址用于显示
  c.set("ipAddress", ip)
  
  let userId: number
  
  if (deviceId) {
    // 方案1：使用 Device ID（推荐）
    const deviceUser = await db
      .prepare("SELECT id FROM users WHERE device_id = ?")
      .bind(deviceId)
      .first<{ id: number }>()
    
    if (deviceUser) {
      userId = deviceUser.id
    } else {
      // 新用户：创建账号，使用 UUID 前8位作为昵称
      const nickname = generateNickname()
      const result = await db
        .prepare("INSERT INTO users (device_id, nickname) VALUES (?, ?)")
        .bind(deviceId, nickname)
        .run()
      userId = Number(result.meta.last_row_id)
    }
  } else {
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
