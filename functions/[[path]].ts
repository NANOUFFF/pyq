import { Hono } from "hono"
import { handle } from "hono/cloudflare-pages"
import { momentsRoutes } from "../src/routes/moments"
import { usersRoutes } from "../src/routes/users"
import { uploadRoutes } from "../src/routes/upload"
import { adminRoutes } from "../src/routes/admin"
import { authMiddleware } from "../src/middleware/auth"

export type Env = {
  DB: D1Database
  ALIYUN_OSS_ACCESS_KEY_ID: string
  ALIYUN_OSS_ACCESS_KEY_SECRET: string
  ALIYUN_OSS_BUCKET: string
  ALIYUN_OSS_ENDPOINT: string
  APP_NAME: string
  API_PREFIX: string
  ADMIN_TOKEN?: string
}

const app = new Hono<{ Bindings: Env; Variables: { userId: number; ipAddress: string } }>()

app.use("/*", async (c, next) => {
  c.res.headers.set("Access-Control-Allow-Origin", "*")
  c.res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
  c.res.headers.set("Access-Control-Allow-Headers", "*")
  if (c.req.method === "OPTIONS") {
    return c.body(null, 200)
  }
  await next()
})

app.use("/api/*", authMiddleware)

app.get("/", (c) => c.json({ app: c.env.APP_NAME, version: "1.0.0", status: "ok" }))

app.route("/api/moments", momentsRoutes)
app.route("/api/users", usersRoutes)
app.route("/api/upload", uploadRoutes)
app.route("/api/admin", adminRoutes)

export const onRequest = handle(app)
