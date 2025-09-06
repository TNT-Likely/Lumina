import { Controller } from 'egg'
import { orgManagementService } from '@lumina/data'

export default class AccountController extends Controller {
  async updateProfile() {
    const { ctx } = this
    const userId = ctx.state.user?.id
    if (!userId) { ctx.status = 401; ctx.body = { success: false, code: 401, message: '未登录' }; return }
    try {
      const data = await orgManagementService.updateProfile(userId, ctx.request.body || {})
      if (!data) { ctx.status = 404; ctx.body = { success: false, message: '用户不存在' }; return }
      ctx.body = { success: true, data }
    } catch (e) {
      ctx.body = { success: false, message: (e as Error).message }
    }
  }

  async changePassword() {
    const { ctx } = this
    const userId = ctx.state.user?.id
    if (!userId) { ctx.status = 401; ctx.body = { success: false, code: 401, message: '未登录' }; return }
    const { oldPassword, newPassword } = ctx.request.body || {}
    try {
      const ok = await orgManagementService.changePassword(userId, oldPassword, newPassword)
      ctx.body = { success: true, data: ok }
    } catch (e) {
      ctx.body = { success: false, message: (e as Error).message }
    }
  }
}
