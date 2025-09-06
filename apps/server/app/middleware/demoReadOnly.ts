import { Context } from 'egg'

/**
 * Demo 只读中间件
 * - 当启用环境变量 DEMO_BLOCK_USER_ID（逗号分隔多个 id）时，命中用户将被禁止对关键资源执行写操作
 * - 允许 GET/HEAD/OPTIONS；仅拦截资源“更新/删除”（PUT/PATCH/DELETE）请求
 * - 注意：放行 POST 查询与测试类接口（如数据查询、连通性测试、签名生成等），避免误伤
 */
export default function demoReadOnly() {
  const idSet = new Set(
    String(process.env.DEMO_BLOCK_USER_ID || '')
      .split(',')
      .map(s => Number(s.trim()))
      .filter(n => Number.isFinite(n))
  )
  const enabled = idSet.size > 0

  return async function demoReadOnlyMiddleware(ctx: Context, next: () => Promise<void>) {
    if (!enabled) return next()

    const uid = Number(ctx.state.user?.id)
    if (!idSet.has(uid)) return next()

    // 本中间件改为“局部接入”，只要路由挂载了它则直接拦截（更精确，不依赖方法/路径判断）
    ctx.status = 200
    ctx.body = { success: false, code: 200, message: '演示环境：该账号仅可体验不可保存变更' }
  }
}
