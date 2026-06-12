const { execSync } = require("child_process")

try {
  console.log("=== Deploying to Cloudflare Workers ===")
  const deployOut = execSync("npx.cmd wrangler deploy", { cwd: __dirname, encoding: "utf-8", timeout: 120000 })
  console.log(deployOut)
} catch(e) {
  console.log("STDOUT:", e.stdout)
  console.log("STDERR:", e.stderr)
}

try {
  console.log("\n=== Running DB Migration ===")
  const migrateOut = execSync("npx.cmd wrangler d1 execute moment-wall-db --file=./src/db/migrations/002_add_initial_nickname.sql --remote", { cwd: __dirname, encoding: "utf-8", timeout: 120000 })
  console.log(migrateOut)
} catch(e) {
  console.log("STDOUT:", e.stdout)
  console.log("STDERR:", e.stderr)
}