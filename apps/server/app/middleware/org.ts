import { Context } from 'egg'

export default function orgScope() {
  return async function orgMiddleware(ctx: Context, next: () => Promise<void>) {
    // 简化：从 Header X-Org-Id 或默认 1（也可从 token 内部扩展）
    const headerVal = ctx.get('x-org-id')
    const orgId = headerVal ? parseInt(headerVal, 10) : 1
    ctx.state.orgId = Number.isFinite(orgId) ? orgId : 1
    await next()
  }
}
