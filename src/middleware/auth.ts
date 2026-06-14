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
  const ip = extractClientIP(c.req.raw)             // 仅用于新用户记录，不用于匹配
  
  c.set("ipAddress", ip)
  
  let userId: number

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
        await db.prepare("UPDATE users SET device_id = ? WHERE id = ? AND (device_id IS NULL OR device_id != ?)")
          .bind(deviceId, userId, deviceId).run()
      }
    }
  }

  // ─── 第二优先级：通过 Device ID 匹配（仅当有 deviceId 时）───
  if (!userId! && deviceId) {
    const deviceUser = await db
      .prepare("SELECT id FROM users WHERE device_id = ?")
      .bind(deviceId)
      .first<{ id: number }>()
    
    if (deviceUser) {
      userId = deviceUser.id
    }
  }
  
  // ─── 都找不到 → 创建新用户（不通过 IP 匹配，避免同 WiFi 共用账号）───
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
