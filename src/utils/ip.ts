import type { Context } from "hono"

export function extractClientIP(request: Request): string {
  const cfIP = request.headers.get("CF-Connecting-IP")
  if (cfIP) return cfIP
  const forwarded = request.headers.get("X-Forwarded-For")
  if (forwarded) return forwarded.split(",")[0].trim()
  const realIP = request.headers.get("X-Real-IP")
  if (realIP) return realIP
  return "0.0.0.0"
}

/**
 * 从 Cloudflare 的 cf 对象中提取用户地理位置
 * c.req.raw.cf 由 Cloudflare 自动注入，包含 country/city/region 等信息
 */
export function extractLocation(c: Context): string {
  try {
    const cf = (c.req.raw as any).cf
    if (!cf) return "未知位置"

    const city = cf.city
    const region = cf.region
    const country = cf.country

    // 优先显示 城市 + 省份（国内）
    if (country === "CN" || !country) {
      if (city && region) return `来自${region}·${city}`
      if (city) return `来自${city}`
      if (region) return `来自${region}`
      return "来自中国"
    }

    // 国外
    if (city && country) return `来自${city}·${country}`
    if (country) return `来自${country}`
    return "未知位置"
  } catch {
    return "未知位置"
  }
}

export function generateMomentId(): string {
  return "mom_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

export function generateMediaId(): string {
  return "media_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}