export async function onRequest(context) {
  const env = context.env
  return new Response(JSON.stringify({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    env: {
      APP_NAME: env.APP_NAME || "未设置",
      ALIYUN_OSS_BUCKET: env.ALIYUN_OSS_BUCKET || "未设置",
      hasDB: !!env.DB,
      hasOSSKey: !!env.ALIYUN_OSS_ACCESS_KEY_ID
    }
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  })
}