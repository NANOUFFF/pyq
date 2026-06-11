import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { generateOSSUploadConfig } from "../services/oss"
import { generateMediaId } from "../utils/ip"

const router = new Hono<{ Bindings: { DB: D1Database; ALIYUN_OSS_ACCESS_KEY_ID: string; ALIYUN_OSS_ACCESS_KEY_SECRET: string; ALIYUN_OSS_BUCKET: string; ALIYUN_OSS_ENDPOINT: string }; Variables: { userId: number } }>()

const uploadSchema = z.object({ fileName: z.string().min(1), contentType: z.string().min(1) })

router.post("/", zValidator("json", uploadSchema), async (c) => {
  const userId = c.get("userId"); const db = c.env.DB
  const { fileName, contentType } = c.req.valid("json")
  const { ALIYUN_OSS_ACCESS_KEY_ID, ALIYUN_OSS_ACCESS_KEY_SECRET, ALIYUN_OSS_BUCKET, ALIYUN_OSS_ENDPOINT } = c.env
  if (!ALIYUN_OSS_ACCESS_KEY_ID || !ALIYUN_OSS_ACCESS_KEY_SECRET || !ALIYUN_OSS_BUCKET) {
    return c.json({ success: false, error: "OSS 未配置" }, 500)
  }
  const mediaType = contentType.startsWith("video/") ? "video" : "image"
  try {
    const uploadConfig = await generateOSSUploadConfig(
      { accessKeyId: ALIYUN_OSS_ACCESS_KEY_ID, accessKeySecret: ALIYUN_OSS_ACCESS_KEY_SECRET, bucket: ALIYUN_OSS_BUCKET, endpoint: ALIYUN_OSS_ENDPOINT || "oss-cn-hangzhou.aliyuncs.com" },
      fileName, contentType
    )
    const mediaId = generateMediaId()
    await db.prepare("INSERT INTO media (id, user_id, media_type, original_name, storage_url, storage_path) VALUES (?, ?, ?, ?, ?, ?)").bind(mediaId, userId, mediaType, fileName, uploadConfig.publicUrl, uploadConfig.key).run()
    return c.json({ success: true, data: uploadConfig })
  } catch (e: any) {
    return c.json({ success: false, error: "生成上传配置失败: " + e.message }, 500)
  }
})

export { router as uploadRoutes }
