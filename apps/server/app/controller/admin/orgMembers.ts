import { Controller } from 'egg'
import { orgManagementService, rbacService } from '@lumina/data'

export default class AdminOrgMembersController extends Controller {
  async list() {
    const { ctx } = this
    const orgId = Number(ctx.params.orgId)
    try {
      // ADMIN 权限由中间件统一校验
      const data = await orgManagementService.listMembers(orgId)
      ctx.body = { success: true, data }
    } catch (e) {
      ctx.body = { success: false, message: (e as Error).message }
    }
  }

  async add() {
    const { ctx } = this
    const orgId = Number(ctx.params.orgId)
    const { userId, role } = ctx.request.body || {}
    try {
      // ADMIN 权限由中间件统一校验
      const data = await orgManagementService.addMember(orgId, Number(userId), role)
      ctx.body = { success: true, data }
    } catch (e) {
      ctx.body = { success: false, message: (e as Error).message }
    }
  }

  async addBatch() {
    const { ctx } = this
    const orgId = Number(ctx.params.orgId)
    const { items } = ctx.request.body as { items: Array<{ userId: number, role: 'ADMIN'|'EDITOR'|'VIEWER' }> } || { items: [] }
    try {
      const data = await orgManagementService.addMembers(orgId, Array.isArray(items) ? items : [])
      ctx.body = { success: true, data }
    } catch (e) {
      ctx.body = { success: false, message: (e as Error).message }
    }
  }

  async updateRole() {
    const { ctx } = this
    const orgId = Number(ctx.params.orgId)
    const userId = Number(ctx.params.userId)
    const { role } = ctx.request.body || {}
    try {
      // ADMIN 权限由中间件统一校验
      const operatorId = Number(ctx.state.user?.id || 0)
      // 兜底：修改自己的角色（避免将自己降权导致组织失管）
      if (userId === operatorId) {
        ctx.status = 403; ctx.body = { success: false, code: 403, message: '不能修改自己的角色' }; return
      }
      // 非 root 不允许修改其他 ADMIN 的角色
      if (!rbacService.isRoot(operatorId)) {
        const target = await orgManagementService.getMember(orgId, userId)
        if (target?.role === 'ADMIN' && userId !== operatorId) {
          ctx.status = 403; ctx.body = { success: false, code: 403, message: '仅 root 可修改其他管理员' }; return
        }
      }
      const data = await orgManagementService.updateMemberRole(orgId, userId, role)
      if (!data) { ctx.status = 404; ctx.body = { success: false, message: '成员不存在' }; return }
      ctx.body = { success: true, data }
    } catch (e) {
      ctx.body = { success: false, message: (e as Error).message }
    }
  }

  async remove() {
    const { ctx } = this
    const orgId = Number(ctx.params.orgId)
    const userId = Number(ctx.params.userId)
    try {
      // ADMIN 权限由中间件统一校验
      const operatorId = Number(ctx.state.user?.id || 0)
      // 兜底：不允许用户删除自己
      if (operatorId === userId) {
        ctx.status = 403; ctx.body = { success: false, code: 403, message: '不能删除自己' }; return
      }
      // 非 root 不允许删除其他 ADMIN
      if (!rbacService.isRoot(operatorId)) {
        const target = await orgManagementService.getMember(orgId, userId)
        if (target?.role === 'ADMIN' && userId !== operatorId) {
          ctx.status = 403; ctx.body = { success: false, code: 403, message: '仅 root 可删除其他管理员' }; return
        }
      }
      const ok = await orgManagementService.removeMember(orgId, userId)
      if (!ok) { ctx.status = 404; ctx.body = { success: false, message: '成员不存在' }; return }
      ctx.body = { success: true }
    } catch (e) {
      ctx.body = { success: false, message: (e as Error).message }
    }
  }
}
