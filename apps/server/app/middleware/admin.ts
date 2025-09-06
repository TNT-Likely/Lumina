import { Context } from 'egg'
import { rbacService } from '@lumina/data'

export default function adminOnly() {
  return async function adminMiddleware(ctx: Context, next: () => Promise<void>) {
    // orgId 可来自路由参数或 state（优先路由）
    const orgId = ctx.params.orgId ? Number(ctx.params.orgId) : ctx.state.orgId
    // root 用户可直接通过
    if (rbacService.isRoot(ctx.state.user?.id)) {
      await next()
      return
    }
    const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, orgId)
    if (role !== 'ADMIN') {
      ctx.status = 403
      ctx.body = { success: false, code: 403, message: '需要管理员权限' }
      return
    }
    await next()
  }
}
