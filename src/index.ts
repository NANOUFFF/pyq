import { Hono } from "hono"
import { cors } from "hono/cors"
import { momentsRoutes } from "./routes/moments"
import { usersRoutes } from "./routes/users"
import { uploadRoutes } from "./routes/upload"
import { adminRoutes } from "./routes/admin"
import { authMiddleware } from "./middleware/auth"

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

export type Variables = {
  userId: number
  ipAddress: string
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

app.use("/*", cors())
app.use("/api/*", authMiddleware)

app.get("/", (c) => c.json({ app: c.env.APP_NAME, version: "1.0.0", status: "ok" }))

app.route("/api/moments", momentsRoutes)
app.route("/api/users", usersRoutes)
app.route("/api/upload", uploadRoutes)
app.route("/api/admin", adminRoutes)

export default app
