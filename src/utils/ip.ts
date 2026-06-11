export function extractClientIP(request: Request): string {
  const cfIP = request.headers.get("CF-Connecting-IP")
  if (cfIP) return cfIP
  const forwarded = request.headers.get("X-Forwarded-For")
  if (forwarded) return forwarded.split(",")[0].trim()
  const realIP = request.headers.get("X-Real-IP")
  if (realIP) return realIP
  return "0.0.0.0"
}

export function generateMomentId(): string {
  return "mom_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}

export function generateMediaId(): string {
  return "media_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 8)
}
