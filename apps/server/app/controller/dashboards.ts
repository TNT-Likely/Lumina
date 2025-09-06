// app/controller/dashboards.ts
import { Controller } from 'egg'
import { dashboardService, rbacService, viewService, type ServiceContext } from '@lumina/data'

export default class DashboardController extends Controller {
  public async list() {
    const { ctx } = this
    const { id, name, creator, page = 1, pageSize = 20, sortBy, sortOrder } = ctx.query
    const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
    const svcCtx: ServiceContext = { user: { id: ctx.state.user?.id, username: ctx.state.user?.username }, orgId: ctx.state.orgId, role }
    const result = await dashboardService.list({
      id: Number(id),
      name,
      creator,
      page: Number(page),
      pageSize: Number(pageSize),
      sortBy,
      sortOrder: sortOrder as 'asc' | 'desc',
    }, svcCtx)
    ctx.body = { success: true, data: { list: result.data, ...result.pagination, canCreate: result.canCreate } }
  }

  public async show() {
    const { ctx } = this
    const { id } = ctx.params
    const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
    const dashboard = await dashboardService.findById(id, { explainAuth: true }, { ...ctx.state, role } as ServiceContext)
    if (dashboard) {
      // 额外检查：当前用户是否能访问该看板中的所有视图组件
      // 若存在任一视图无权限，则提示前端考虑生成预览 token（dashboard 级）
      let needViewToken = false
      try {
        const raw = (dashboard as unknown as { toJSON?: () => unknown }).toJSON?.() ?? (dashboard as unknown as Record<string, unknown>)
        const cfg = (raw as Record<string, unknown>).config as unknown
        const components: Array<{ type?: string, config?: { viewId?: number } }> = Array.isArray((cfg as { components?: unknown })?.components)
          ? (cfg as { components?: unknown }).components as Array<{ type?: string, config?: { viewId?: number } }>
          : []
        const viewIds = components
          .filter(c => (c?.type === 'view') && typeof c?.config?.viewId === 'number')
          .map(c => Number(c.config!.viewId))
          .filter((v, idx, arr) => Number.isFinite(v) && arr.indexOf(v) === idx)

        for (const vid of viewIds) {
          try {
            // explainAuth=true 时，无权限会抛 Forbidden；不存在则返回 null
            await viewService.findById(vid, { explainAuth: true }, { ...ctx.state, role } as ServiceContext)
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            if (/forbidden/i.test(msg)) { needViewToken = true; break }
          }
        }
      } catch { /* 忽略检查错误，保持兼容 */ }

      const payload = (dashboard as unknown as { toJSON?: () => unknown }).toJSON?.() ?? dashboard
      ctx.body = {
        success: true,
        data: { ...(payload as Record<string, unknown>), needViewToken },
      }
    } else {
      ctx.status = 404
      ctx.body = { success: false, message: 'Dashboard not found' }
    }
  }

  public async create() {
    const { ctx } = this
    const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
    const dashboard = await dashboardService.create({ ...ctx.request.body, orgId: ctx.state.orgId, ownerId: ctx.state.user?.id }, { ...ctx.state, role } as ServiceContext)
    ctx.body = { success: true, data: dashboard }
  }

  public async update() {
    const { ctx } = this
    const { id } = ctx.params
    const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
    const dashboard = await dashboardService.update(id, ctx.request.body, { ...ctx.state, role } as ServiceContext)
    if (dashboard) {
      ctx.body = { success: true, data: dashboard }
    } else {
      ctx.status = 404
      ctx.body = { success: false, message: 'Dashboard not found' }
    }
  }

  public async destroy() {
    const { ctx } = this
    const { id } = ctx.params
    const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
    const result = await dashboardService.delete(id, { ...ctx.state, role } as ServiceContext)
    if (result) {
      ctx.body = { success: true, message: 'Dashboard deleted successfully' }
    } else {
      ctx.status = 404
      ctx.body = { success: false, message: 'Dashboard not found' }
    }
  }

  public async getConfig() {
    const { ctx } = this
    const { id } = ctx.params
    const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
    const dashboard = await dashboardService.findById(id, { explainAuth: false }, { ...ctx.state, role } as ServiceContext)
    if (dashboard) {
      ctx.body = {
        success: true,
        data: dashboard.config || {},
      }
    } else {
      ctx.body = {
        success: false,
        message: 'Dashboard not found',
      }
    }
  }
}
