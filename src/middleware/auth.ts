import { Context, Next } from "hono"
import { extractClientIP } from "../utils/ip"

// 随机昵称词库
const NICKNAME_PARTS = {
  mood: ["开心的", "焦虑的", "迷茫的", "兴奋的", "疲惫的", "悠闲的", "忙碌的", "伤心的", "乐观的", "浪漫的"],
  role: ["上班族", "学生党", "程序员", "设计师", "打工人", "创业者", "自由职业者", "考研人", "加班狗", "摸鱼大师", "夜猫子", "早起鸟"]
}

// 生成随机昵称
function generateRandomNickname(): string {
  const mood = NICKNAME_PARTS.mood[Math.floor(Math.random() * NICKNAME_PARTS.mood.length)]
  const role = NICKNAME_PARTS.role[Math.floor(Math.random() * NICKNAME_PARTS.role.length)]
  return mood + role
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
      // 新用户：创建账号，使用随机昵称
      const nickname = generateRandomNickname()
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
      // 新用户：创建账号，使用随机昵称
      const nickname = generateRandomNickname()
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
