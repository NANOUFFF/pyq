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
  
  // 优先使用 Device ID 识别用户
  let deviceId = c.req.header("X-Device-ID")
  const ip = extractClientIP(c.req.raw)
  
  // 保存 IP 地址用于显示
  c.set("ipAddress", ip)
  
  let userId: number
  
  if (deviceId) {
    // 方案1：使用 Device ID（推荐）
    try {
      console.log("Trying Device ID auth:", deviceId.substring(0, 10) + "...")
      const deviceUser = await db
        .prepare("SELECT id FROM users WHERE device_id = ?")
        .bind(deviceId)
        .first<{ id: number }>()
      
      if (deviceUser) {
        userId = deviceUser.id
        console.log("Found existing user by Device ID:", userId)
      } else {
        // 新用户：创建账号，使用随机字符串作为昵称
        const nickname = generateNickname()
        console.log("Creating new user with Device ID, nickname:", nickname)
        const result = await db
          .prepare("INSERT INTO users (device_id, ip_address, nickname) VALUES (?, ?, ?)")
          .bind(deviceId, ip, nickname)
          .run()
        userId = Number(result.meta.last_row_id)
        console.log("Created new user:", userId)
      }
    } catch (error: any) {
      console.error("Device ID auth error:", error.message || error)
      // 降级到 IP 识别
      deviceId = null
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
