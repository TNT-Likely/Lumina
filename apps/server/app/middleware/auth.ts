import { Context } from 'egg'
import jwt from 'jsonwebtoken'

type IgnoreMatcher = string | RegExp | ((ctx: Context) => boolean);
interface AuthOptions {
  ignore?: IgnoreMatcher[];
}

function isIgnored(ctx: Context, matchers?: IgnoreMatcher[]) {
  if (!matchers || !matchers.length) return false
  return matchers.some(m => {
    if (typeof m === 'string') return ctx.path === m
    if (m instanceof RegExp) return m.test(ctx.path)
    if (typeof m === 'function') return !!m(ctx)
    return false
  })
}

export default function auth(options?: AuthOptions) {
  return async function authMiddleware(ctx: Context, next: () => Promise<void>) {
    // 预检请求直接放行，避免跨域阻塞
    if (ctx.method === 'OPTIONS') return next()

    // 忽略白名单路由
    if (isIgnored(ctx, options?.ignore)) return next()

    const header = ctx.get('authorization') || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) {
      ctx.status = 401
      ctx.body = { success: false, code: 401, message: '未登录' }
      return
    }
    try {
      const payload = jwt.verify(token, ctx.app.config.keys) as { uid: number; username: string }
      ctx.state.user = { id: payload.uid, username: payload.username }
    } catch {
      ctx.status = 401
      ctx.body = { success: false, code: 401, message: '登录已过期，请重新登录' }
      return
    }

    await next()
  }
}
