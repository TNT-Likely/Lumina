// apps/api-server/app/controller/views.ts
import { Controller } from 'egg'
import { viewService, rbacService, datasetService, type ViewServiceQueryParams, type ServiceContext } from '@lumina/data'

export default class ViewController extends Controller {
  public async list() {
    const { ctx } = this
    const { id, name, datasetId, page, pageSize } = ctx.query
    const queryParams: ViewServiceQueryParams = {
      id: id ? parseInt(id as string, 10) : undefined,
      name: name as string,
      datasetId: datasetId ? parseInt(datasetId as string, 10) : undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string, 10) : undefined,
    }
    const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
    const svcCtx: ServiceContext = { user: { id: ctx.state.user?.id, username: ctx.state.user?.username }, orgId: ctx.state.orgId, role }
    const result = await viewService.findAll({ ...queryParams }, svcCtx)
    ctx.body = { success: true, data: { list: result.data, ...result.pagination, canCreate: result.canCreate } }
  }

  public async show() {
    const { ctx } = this
    const { id } = ctx.params
    try {
      ctx.logger.info('GET /api/views/:id show called', { id, params: ctx.params })
    } catch {}
    const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
    const view = await viewService.findById(id, { explainAuth: true }, { ...ctx.state, role } as ServiceContext)
    // findById(explainAuth=true) 要么返回实体，要么抛出 AppError(403/404)
    ctx.body = { success: true, data: view }
  }

  public async create() {
    const { ctx } = this
    const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
    const view = await viewService.create({ ...ctx.request.body, orgId: ctx.state.orgId, ownerId: ctx.state.user?.id }, { ...ctx.state, role } as ServiceContext)
    ctx.body = { success: true, data: view }
  }

  public async update() {
    const { ctx } = this
    const { id } = ctx.params
    try {
      ctx.logger.info('PUT /api/views/:id update called', { id, body: ctx.request.body })
    } catch {}
    const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
    const view = await viewService.update(id, ctx.request.body, { ...ctx.state, role } as ServiceContext)
    if (view) ctx.body = { success: true, data: view }
    else ctx.body = { success: false, message: 'View not found' }
  }

  public async destroy() {
    const { ctx } = this
    const { id } = ctx.params
    const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
    const result = await viewService.delete(id, { ...ctx.state, role } as ServiceContext)
    if (result) {
      ctx.body = { success: true, message: 'View deleted successfully' }
    } else {
      ctx.body = { success: false, message: 'View not found' }
    }
  }

  public async getConfig() {
    const { ctx } = this
    const { id } = ctx.params
    try {
      ctx.logger.info('GET /api/views/:id/config called', { id })
    } catch {}
    const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
    const view = await viewService.findById(id, { explainAuth: true }, { ...ctx.state, role } as ServiceContext)
    ctx.body = { success: true, data: (view as NonNullable<typeof view>).config || {} }
  }

  public async getChildren() {
    const { ctx } = this
    const { id } = ctx.params
    const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
    const view = await viewService.findById(id, { explainAuth: false }, { ...ctx.state, role } as ServiceContext)
    if (!view) { ctx.body = { success: false, message: 'View not found' }; return }
    // 假设视图的config中包含children字段
    // eslint-disable-next-line
    const childrenIds = view.config?.['children'] || [];
    const children = [] as unknown[]
    for (const childId of childrenIds) {
      const child = await viewService.findById(childId, { explainAuth: false }, { ...ctx.state, role } as ServiceContext)
      if (child) { children.push(child as unknown) }
    }
    ctx.body = { success: true, data: children }
  }

  // 新增：获取视图数据
  public async getData() {
    const { ctx } = this
    const { id } = ctx.params
    const vid = Number(id)
    if (!Number.isFinite(vid)) {
      try { ctx.logger.warn('Invalid view id param in getData', { rawId: id, params: ctx.params, body: ctx.request.body }) } catch {} // best-effort logging
      ctx.status = 400
      ctx.body = { success: false, message: 'Invalid view id' }
      return
    }
    const queryParams = ctx.request.body
    const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
    const data = await viewService.getData(vid, queryParams, { ...ctx.state, role } as ServiceContext)
    ctx.body = { success: true, data }
  }

  // 新增：视图详情（合并视图配置与数据集字段），用于减少前端请求数
  public async detail() {
    const { ctx } = this
    const { id } = ctx.params
    try {
      ctx.logger.info('GET /api/views/:id/detail called', { id })
    } catch {}
    const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
    const view = await viewService.findById(id, { explainAuth: true }, { ...ctx.state, role } as ServiceContext)
    const cfg = (view as NonNullable<typeof view>).config || {}
    let fields: Array<Record<string, unknown>> = []
    const dsId = Number(((view as unknown as { datasetId?: number }).datasetId) || 0)
    if (dsId) {
      try {
        fields = await datasetService.getDatasetFields(dsId, { ...ctx.state, role } as ServiceContext) as unknown as Array<Record<string, unknown>>
      } catch { /* 忽略字段获取失败 */ }
    }
    const vmeta = view as unknown as { id: number, name: string, description?: string }
    const desc = vmeta?.description
    ctx.body = { success: true, data: { id: vmeta.id, name: vmeta.name, description: desc, config: cfg, datasetId: dsId || undefined, fields } }
  }
}
