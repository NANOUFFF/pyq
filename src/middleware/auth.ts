import { Context, Next } from "hono"
import { extractClientIP } from "../utils/ip"

export async function authMiddleware(c: Context, next: Next) {
  const ip = extractClientIP(c.req.raw)
  c.set("ipAddress", ip)
  const db = c.env.DB
  let user = await db
    .prepare("SELECT id FROM users WHERE ip_address = ?")
    .bind(ip)
    .first<{ id: number }>()
  if (!user) {
    const result = await db
      .prepare("INSERT INTO users (ip_address) VALUES (?)")
      .bind(ip)
      .run()
    user = { id: Number(result.meta.last_row_id) }
  }
  c.set("userId", user.id)
  await next()
}
