
// app/controller/subscriptions.ts
import { Controller } from 'egg'
import { subscribeService, rbacService } from '@lumina/data'
import { type ServiceContext } from '@lumina/data'

export default class SubscriptionController extends Controller {
  public async list() {
    const { ctx } = this
    try {
      const { page = 1, pageSize = 20, sortOrder } = ctx.query
      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const svcCtx: ServiceContext = { user: { id: ctx.state.user?.id, username: ctx.state.user?.username }, orgId: ctx.state.orgId, role }
      const result = await subscribeService.findAll(
        {
          ...ctx.query,
          page: Number(page),
          pageSize: Number(pageSize),
          sortOrder: sortOrder as 'asc' | 'desc',
        },
        svcCtx
      )
      ctx.body = { success: true, data: { list: result.data, ...result.pagination, canCreate: result.canCreate } }
    } catch (error) {
      ctx.body = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // 连通性测试
  public async testConnection() {
    const { ctx } = this
    const { id } = ctx.params
    try {
      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const result = await subscribeService.testConnection(Number(id), { ...ctx.state, role } as ServiceContext)
      ctx.body = result
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
      const subscription = await subscribeService.findById(Number(id), { bypassAuth: false }, { ...ctx.state, role } as ServiceContext)
      if (subscription) {
        ctx.body = {
          success: true,
          data: subscription,
        }
      } else {
        ctx.body = {
          success: false,
          message: 'Subscription not found',
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
      const subscription = await subscribeService.create({ ...ctx.request.body, orgId: ctx.state.orgId, ownerId: ctx.state.user?.id }, { ...ctx.state, role } as ServiceContext)
      ctx.body = {
        success: true,
        data: subscription,
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
      const subscription = await subscribeService.update(Number(id), ctx.request.body, { ...ctx.state, role } as ServiceContext)
      if (subscription) {
        ctx.body = { success: true, data: subscription }
      } else {
        ctx.body = { success: false, message: 'Subscription not found' }
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
      const result = await subscribeService.delete(Number(id), { ...ctx.state, role } as ServiceContext)
      if (result) {
        ctx.body = { success: true, message: 'Subscription deleted successfully' }
      } else {
        ctx.body = { success: false, message: 'Subscription not found' }
      }
    } catch (error) {
      ctx.body = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  // 启用/禁用订阅
  public async toggleEnabled() {
    const { ctx } = this
    const { id } = ctx.params
    const { enabled } = ctx.request.body
    try {
      const role = await rbacService.getUserRoleInOrg(ctx.state.user?.id, ctx.state.orgId)
      const result = await subscribeService.toggleEnabled(Number(id), enabled, { ...ctx.state, role } as ServiceContext)
      if (enabled) await this.app.manager?.sendNext(id)
      ctx.body = result
    } catch (error) {
      ctx.body = {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}
