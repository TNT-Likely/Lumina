import { Controller } from 'egg'
import { orgManagementService, isAppError, AppError } from '@lumina/data'

export default class InvitesController extends Controller {
  async accept() {
    const { ctx } = this
    const userId = ctx.state.user?.id
    if (!userId) { ctx.status = 401; ctx.body = { success: false, code: 401, message: '未登录' }; return }
    const { token } = ctx.params
    try {
      const ok = await orgManagementService.acceptInvite(token, userId)
      ctx.body = { success: true, data: ok }
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
