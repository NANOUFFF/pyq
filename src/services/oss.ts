export interface OSSUploadConfig {
  accessKeyId: string; accessKeySecret: string; bucket: string; endpoint: string
}

export interface UploadResult {
  ossHost: string; policy: string; signature: string; ossAccessKeyId: string
  key: string; successActionStatus: string; publicUrl: string
}

export async function generateOSSUploadConfig(
  config: OSSUploadConfig, fileName: string, contentType: string, maxSize = 10 * 1024 * 1024
): Promise<UploadResult> {
  const { accessKeyId, accessKeySecret, bucket, endpoint } = config
  const objectKey = "moments/" + Date.now().toString(36) + "_" + fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
  const expiration = new Date(Date.now() + 3600 * 1000).toISOString()
  const policyObj = { expiration, conditions: [["content-length-range", 0, maxSize], { bucket }, ["starts-with", "$key", "moments/"], ["eq", "$success_action_status", "200"]] }
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
