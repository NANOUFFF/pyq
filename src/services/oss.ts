export interface OSSUploadConfig {
  accessKeyId: string; accessKeySecret: string; bucket: string; endpoint: string
}

export interface UploadResult {
  ossHost: string; policy: string; signature: string; ossAccessKeyId: string
  key: string; successActionStatus: string; publicUrl: string
}

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"
])

const SIZE_LIMITS: Record<string, number> = {
  image: 10 * 1024 * 1024,   // 图片 10MB
  video: 100 * 1024 * 1024,  // 视频 100MB
}

export async function generateOSSUploadConfig(
  config: OSSUploadConfig, fileName: string, contentType: string, maxSize?: number
): Promise<UploadResult> {
  // 1. MIME 类型白名单检查
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new Error("不支持的文件类型: " + contentType)
  }

  const mediaType = contentType.startsWith("video/") ? "video" : "image"
  const sizeLimit = maxSize || SIZE_LIMITS[mediaType] || 10 * 1024 * 1024

  const { accessKeyId, accessKeySecret, bucket, endpoint } = config
  const now = new Date()
  const dateDir = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}`
  const objectKey = `moments/${dateDir}/${Date.now().toString(36)}_${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`
  const expiration = new Date(Date.now() + 3600 * 1000).toISOString()
  const policyObj = {
    expiration,
    conditions: [
      ["content-length-range", 0, sizeLimit],
      { bucket },
      ["starts-with", "$key", "moments/"],
      ["eq", "$success_action_status", "200"]
    ]
  }
  const policyBase64 = btoa(JSON.stringify(policyObj))
  const signature = await hmacSha1(policyBase64, accessKeySecret)
  const ossHost = "https://" + bucket + "." + endpoint
  return { ossHost, policy: policyBase64, signature, ossAccessKeyId: accessKeyId, key: objectKey, successActionStatus: "200", publicUrl: ossHost + "/" + objectKey }
}

async function hmacSha1(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"])
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message))
  const bytes = new Uint8Array(sig)
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}