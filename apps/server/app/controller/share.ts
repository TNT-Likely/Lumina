import { Controller } from 'egg'
import jwt from 'jsonwebtoken'
import { dashboardService, rbacService, viewService, type ServiceContext } from '@lumina/data'

export default class ShareController extends Controller {
  /**
   * 生成看板分享 token
   * body: { dashboardId: number, expiresIn?: string|number, orgScope?: boolean }
   * 返回 { url, token, expireAt? }
   */
  async signDashboard() {
    const { ctx } = this
    const { dashboardId, expiresIn, orgScope } = ctx.request.body as { dashboardId: number, expiresIn?: string | number, orgScope?: boolean }
    if (!dashboardId) { ctx.status = 400; ctx.body = { success: false, message: '缺少 dashboardId' }; return }
    const secret = process.env.PREVIEW_TOKEN_SECRET || ctx.app.config.keys
    // 优先使用看板实际 orgId，避免跨组织预览时因 orgId 不一致导致 404
    const requestedOrgId = orgScope ? Number(ctx.state.orgId || 1) : undefined

    // 校验当前用户对看板的访问权限，并获取真实 ownerId
    try {
      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, requestedOrgId)
      const d = await dashboardService.findById(dashboardId, { explainAuth: false }, { orgId: requestedOrgId, user: { id: ctx.state.user?.id, username: ctx.state.user?.username }, role } as ServiceContext)
      if (!d) { ctx.status = 404; ctx.body = { success: false, message: 'Dashboard not found or no access' }; return }

      const payload: { rid: string; ownerId: number; orgId?: number } = {
        rid: `dashboard:${dashboardId}`,
        ownerId: d.ownerId as number,
      }
  // token 内写入看板实际 orgId（若开启 orgScope），确保公开端按正确组织校验
  type WithOrg = { orgId?: number };
  const dashOrgId = (d as unknown as WithOrg).orgId
  if (orgScope && typeof dashOrgId === 'number') payload.orgId = dashOrgId
  const opts: jwt.SignOptions = {}
  if (expiresIn && String(expiresIn).toLowerCase() !== 'never') opts.expiresIn = expiresIn as jwt.SignOptions['expiresIn']
  const token = jwt.sign(payload, secret as jwt.Secret, opts)
  const params = new URLSearchParams({ id: String(dashboardId) })
  if (payload.orgId) params.set('orgId', String(payload.orgId))
  params.set('token', token)
  const host = process.env.WEB_URL || `http://${ctx.host}`
  const url = `${host.replace(/\/$/, '')}/dashboard/preview?${params.toString()}`
  ctx.body = { success: true, data: { token, url } }
    } catch (err) {
      ctx.status = 500
      ctx.body = { success: false, message: (err as Error).message }
    }
  }

  /**
   * 生成视图分享 token
   * body: { viewId: number, expiresIn?: string|number, orgScope?: boolean }
   * 返回 { url, token }
   */
  async signView() {
    const { ctx } = this
    const { viewId, expiresIn, orgScope } = ctx.request.body as { viewId: number, expiresIn?: string | number, orgScope?: boolean }
    if (!viewId) { ctx.status = 400; ctx.body = { success: false, message: '缺少 viewId' }; return }
    const secret = process.env.PREVIEW_TOKEN_SECRET || ctx.app.config.keys
    const requestedOrgId = orgScope ? Number(ctx.state.orgId || 1) : undefined

    try {
      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, requestedOrgId)
      const v = await viewService.findById(viewId, { explainAuth: false }, { orgId: requestedOrgId, user: { id: ctx.state.user?.id, username: ctx.state.user?.username }, role } as ServiceContext)
      if (!v) { ctx.status = 404; ctx.body = { success: false, message: 'View not found or no access' }; return }

      const payload: { rid: string; ownerId: number; orgId?: number } = {
        rid: `view:${viewId}`,
        ownerId: (v as unknown as { ownerId: number }).ownerId,
      }
      const vOrgId = (v as unknown as { orgId?: number }).orgId
      if (orgScope && typeof vOrgId === 'number') payload.orgId = vOrgId
      const opts: jwt.SignOptions = {}
      if (expiresIn && String(expiresIn).toLowerCase() !== 'never') opts.expiresIn = expiresIn as jwt.SignOptions['expiresIn']
      const token = jwt.sign(payload, secret as jwt.Secret, opts)
      const params = new URLSearchParams({ id: String(viewId) })
      if (payload.orgId) params.set('orgId', String(payload.orgId))
      params.set('token', token)
      const host = process.env.WEB_URL || `http://${ctx.host}`
      const url = `${host.replace(/\/$/, '')}/view/preview?${params.toString()}`
      ctx.body = { success: true, data: { token, url } }
    } catch (err) {
      ctx.status = 500
      ctx.body = { success: false, message: (err as Error).message }
    }
  }
}
