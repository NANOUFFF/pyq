export async function onRequest(context) {
  return new Response(JSON.stringify({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    env: {
      APP_NAME: context.env.APP_NAME || "未设置",
      hasDB: !!context.env.DB
    }
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  })
}