import { Controller } from 'egg'
import { orgManagementService, rbacService, isAppError, AppError } from '@lumina/data'

export default class AdminOrgsController extends Controller {
  async list() {
    const { ctx } = this
    try {
      const userId = Number(ctx.state.user?.id || 0)
      const data = rbacService.isRoot(userId)
        ? await orgManagementService.listOrgs()
        : await orgManagementService.listOrgsForAdmin(userId)
      ctx.body = { success: true, data }
    } catch (e) {
      ctx.body = { success: false, message: (e as Error).message }
    }
  }

  async create() {
    const { ctx } = this
    try {
      const { name, slug } = ctx.request.body || {}
      // 创建组织
      const data = await orgManagementService.createOrg({ name, slug })
      // 将当前用户加入为 ADMIN，便于新组织可立即切换使用
      try {
        const userId = ctx.state.user?.id
        if (userId && data?.id) {
          await orgManagementService.addMember(data.id, Number(userId), 'ADMIN')
        }
      } catch {}
      // 返回精简后的字段，避免直接展开 Sequelize 实例导致属性缺失
      ctx.body = { success: true, data: { id: data.id, name: data.name, slug: data.slug, role: 'ADMIN' } }
    } catch (e) {
      if (isAppError(e)) {
        const err = e as AppError
        ctx.status = err.httpStatus || 400
        ctx.body = { success: false, code: err.bizCode || ctx.status, message: err.message, details: err.details }
      } else {
        ctx.body = { success: false, message: (e as Error).message }
      }
    }
  }

  async update() {
    const { ctx } = this
    try {
      const id = Number(ctx.params.id)
      const userId = Number(ctx.state.user?.id || 0)
      // 非 root 仅可更新自己管理的组织
      if (!rbacService.isRoot(userId)) {
        const m = await orgManagementService.getMember(id, userId)
        if (!m || m.role !== 'ADMIN') {
          ctx.status = 403; ctx.body = { success: false, code: 403, message: '无权限' }; return
        }
      }
      const data = await orgManagementService.updateOrg(id, ctx.request.body || {})
      if (!data) { ctx.status = 404; ctx.body = { success: false, message: '组织不存在' }; return }
      ctx.body = { success: true, data }
    } catch (e) {
      if (isAppError(e)) {
        const err = e as AppError
        ctx.status = err.httpStatus || 400
        ctx.body = { success: false, code: err.bizCode || ctx.status, message: err.message, details: err.details }
      } else {
        ctx.body = { success: false, message: (e as Error).message }
      }
    }
  }

  async destroy() {
    const { ctx } = this
    try {
      const id = Number(ctx.params.id)
      const userId = Number(ctx.state.user?.id || 0)
      // 非 root 仅可删除自己管理的组织
      if (!rbacService.isRoot(userId)) {
        const m = await orgManagementService.getMember(id, userId)
        if (!m || m.role !== 'ADMIN') {
          ctx.status = 403; ctx.body = { success: false, code: 403, message: '无权限' }; return
        }
      }
      // 校验组织是否还存在除自己以外的成员，若存在则禁止删除
      try {
        const members = await orgManagementService.listMembers(id)
        const others = (members || []).filter((m: { userId: number }) => Number(m.userId) !== userId)
        if (others.length > 0) {
          ctx.status = 400
          ctx.body = { success: false, code: 400, message: '组织中仍有其他成员，无法删除。请先移除其他成员。' }
          return
        }
      } catch {}
      const ok = await orgManagementService.deleteOrg(id)
      if (!ok) { ctx.status = 404; ctx.body = { success: false, message: '组织不存在' }; return }
      ctx.body = { success: true }
    } catch (e) {
      if (isAppError(e)) {
        const err = e as AppError
        ctx.status = err.httpStatus || 400
        ctx.body = { success: false, code: err.bizCode || ctx.status, message: err.message, details: err.details }
      } else {
        ctx.body = { success: false, message: (e as Error).message }
      }
    }
  }
}
