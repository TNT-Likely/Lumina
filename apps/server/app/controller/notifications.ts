// app/controller/notifications.ts
import { Controller } from 'egg'
import { notifyService, rbacService, type ServiceContext } from '@lumina/data'

export default class NotificationController extends Controller {
  public async list() {
    const { ctx } = this
    try {
      const params = ctx.query
      // 解析分页、排序、筛选参数
      let sortOrder: 'asc' | 'desc' | undefined
      if (params.sortOrder === 'asc' || params.sortOrder === 'desc') {
        sortOrder = params.sortOrder
      }
      const queryParams = {
        id: params.id ? Number(params.id) : undefined,
        name: params.name as string,
        type: params.type as string,
        page: params.page ? Number(params.page) : 1,
        pageSize: params.pageSize ? Number(params.pageSize) : 10,
        sortBy: params.sortBy as string,
        sortOrder,
      }
      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const svcCtx: ServiceContext = { user: { id: ctx.state.user?.id, username: ctx.state.user?.username }, orgId: ctx.state.orgId, role }
      const result = await notifyService.findAll({ ...queryParams }, svcCtx)
      ctx.body = {
        success: true,
        data: {
          list: result.data,
          ...result.pagination,
          canCreate: result.canCreate,
        },
      }
    } catch (error) {
      ctx.body = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  public async show() {
    const { ctx } = this
    const { id } = ctx.params
    try {
      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const notification = await notifyService.findById(Number(id), { ...ctx.state, role } as ServiceContext)
      if (notification) {
        ctx.body = {
          success: true,
          data: notification,
        }
      } else {
        ctx.body = {
          success: false,
          message: 'Notification not found',
        }
      }
    } catch (error) {
      ctx.body = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  public async create() {
    const { ctx } = this
    try {
      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const notification = await notifyService.create({ ...ctx.request.body, orgId: ctx.state.orgId, ownerId: ctx.state.user?.id }, { ...ctx.state, role } as ServiceContext)
      ctx.body = {
        success: true,
        data: notification,
      }
    } catch (error) {
      ctx.body = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  public async update() {
    const { ctx } = this
    const { id } = ctx.params
    try {
      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const notification = await notifyService.update(Number(id), ctx.request.body, { ...ctx.state, role } as ServiceContext)
      if (notification) {
        ctx.body = { success: true, data: notification }
      } else {
        ctx.body = { success: false, message: 'Notification not found' }
      }
    } catch (error) {
      ctx.body = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  public async destroy() {
    const { ctx } = this
    const { id } = ctx.params
    try {
      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const result = await notifyService.delete(Number(id), { ...ctx.state, role } as ServiceContext)
      if (result) {
        ctx.body = { success: true, message: 'Notification deleted successfully' }
      } else {
        ctx.body = { success: false, message: 'Notification not found' }
      }
    } catch (error) {
      ctx.body = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // 测试通知连通性
  public async testConnection() {
    const { ctx } = this
    const { id } = ctx.params
    const { type } = ctx.request.body as { type: 'text' | 'image' }
    try {
      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const result = await notifyService.testConnection(Number(id), type, { ...ctx.state, role } as ServiceContext)
      if (!result.success && result.message === 'Forbidden') {
        ctx.status = 403
      }
      ctx.body = {
        success: result.success,
        message: result.message,
      }
    } catch (error) {
      ctx.body = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}
