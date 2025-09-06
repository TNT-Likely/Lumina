import { Controller } from 'egg'
import { dashboardService, viewService, datasetService, type OrgRole, type ServiceContext } from '@lumina/data'

/**
 * 公共预览控制器：仅提供只读访问
 * 规则：
 * - 无 token 时，仅允许 visibility=public 的资源
 * - 有有效 preview token 时，若 token.rid 与请求资源匹配，可按 token 提供的 ownerId 视为本人；若有 orgId 则视为组织成员
 */
export default class PreviewController extends Controller {
  public async dashboard() {
    const { ctx } = this
    const { id } = ctx.params
    // 优先使用 token 中的 orgId，其次 query/header，避免 orgId 不一致导致的 404
    const pv = ctx.state.preview as { rid?: string | null, ownerId?: number | null, orgId?: number | null } | null
    const orgIdRaw = pv?.orgId ?? (ctx.query.orgId ? Number(ctx.query.orgId) : undefined)
    const orgId = typeof orgIdRaw === 'number' && Number.isFinite(orgIdRaw) ? orgIdRaw : undefined

    // 预览上下文
    const rid = `dashboard:${id}`
    let currentUserId: number | null = null
    let role: OrgRole | null = null
    if (pv && (pv.rid === rid || pv.rid === '*')) {
      // 预览 token 内含 ownerId 时，按所有者视角读取（允许私有）
      currentUserId = pv.ownerId ?? null
      // 若 token 指定 orgId，再赋予 VIEWER 读取 org 可见资源
      role = pv.orgId ? 'VIEWER' : null
    }

    const svcCtx: ServiceContext = { orgId, user: { id: currentUserId ?? undefined, username: undefined }, role } as ServiceContext
    const dashboard = await dashboardService.findById(id, { explainAuth: true }, svcCtx)
    // explainAuth=true 会在未找到或无权限时抛出 AppError（由全局中间件转换为 404/403）
    ctx.body = { success: true, data: dashboard }
  }

  public async viewData() {
    const { ctx } = this
    const { id } = ctx.params
    const pv = ctx.state.preview as { rid?: string | null, ownerId?: number | null, orgId?: number | null } | null
    const orgIdRaw = pv?.orgId ?? (ctx.query.orgId ? Number(ctx.query.orgId) : undefined)
    const orgId = typeof orgIdRaw === 'number' && Number.isFinite(orgIdRaw) ? orgIdRaw : undefined
    const queryParams = ctx.request.body || {}

    const rid = `view:${id}`
    let currentUserId: number | null = null
    let role: OrgRole | null = null
    if (pv && (pv.rid === rid || pv.rid === '*' || (typeof pv.rid === 'string' && pv.rid.startsWith('dashboard:')))) {
      currentUserId = pv.ownerId ?? null
      role = pv.orgId ? 'VIEWER' : null
    }

    // 服务层将抛出 AppError，交由全局错误处理中间件统一映射 404/403
    const svcCtx: ServiceContext = { orgId, user: { id: currentUserId ?? undefined, username: undefined }, role } as ServiceContext
    const data = await viewService.getData(Number(id), queryParams, svcCtx)
    ctx.body = { success: true, data }
  }

  // 公开获取视图配置：与受保护接口一致，但走预览RBAC（public 或携带有效token）
  public async viewConfig() {
    const { ctx } = this
    const { id } = ctx.params
    const pv = ctx.state.preview as { rid?: string | null, ownerId?: number | null, orgId?: number | null } | null
    const orgIdRaw = pv?.orgId ?? (ctx.query.orgId ? Number(ctx.query.orgId) : undefined)
    const orgId = typeof orgIdRaw === 'number' && Number.isFinite(orgIdRaw) ? orgIdRaw : undefined

    const rid = `view:${id}`
    let currentUserId: number | null = null
    let role: OrgRole | null = null
    if (pv && (pv.rid === rid || pv.rid === '*' || (typeof pv.rid === 'string' && pv.rid.startsWith('dashboard:')))) {
      currentUserId = pv.ownerId ?? null
      role = pv.orgId ? 'VIEWER' : null
    }

    const view = await viewService.findById(id, { explainAuth: true }, { orgId, user: { id: currentUserId ?? undefined, username: undefined }, role } as ServiceContext)
    // explainAuth=true：未找到或无权限将抛 AppError，由全局中间件处理
    ctx.body = { success: true, data: (view!).config || {} }
  }

  // 公开获取视图详情（配置 + 数据集字段）：支持 view token 或 dashboard token
  public async viewDetail() {
    const { ctx } = this
    const { id } = ctx.params
    const pv = ctx.state.preview as { rid?: string | null, ownerId?: number | null, orgId?: number | null } | null
    const orgId = (typeof pv?.orgId === 'number' && Number.isFinite(pv.orgId)) ? pv.orgId : undefined

    const rid = `view:${id}`
    let currentUserId: number | null = null
    let role: OrgRole | null = null
    if (pv && (pv.rid === rid || pv.rid === '*' || (typeof pv.rid === 'string' && pv.rid.startsWith('dashboard:')))) {
      currentUserId = pv.ownerId ?? null
      role = 'VIEWER'
    }

    const svcCtx: ServiceContext = { orgId, user: { id: currentUserId ?? undefined, username: undefined }, role } as ServiceContext
    const view = await viewService.findById(id, { explainAuth: true }, svcCtx)
    // explainAuth=true：未找到或无权限将抛 AppError，由全局中间件处理
    const cfg = (view!).config || {}
    const visibility = ((view as unknown as { visibility?: string })!).visibility
    const dsId = Number(((view as unknown as { datasetId?: number })!).datasetId || 0)
    let fields: Array<Record<string, unknown>> = []
    if (dsId) {
      try {
        fields = await datasetService.getDatasetFields(dsId, { orgId, user: { id: currentUserId ?? undefined, username: undefined }, role } as ServiceContext) as unknown as Array<Record<string, unknown>>
      } catch {
        /* ignore */
      }
    }
    const name = ((view as unknown as { name?: string })!.name) || ''
    ctx.body = { success: true, data: { id: (view!).id, name, visibility, config: cfg, datasetId: dsId || undefined, fields } }
  }
}
