import { Controller } from 'egg'
import { orgService, isAppError, AppError } from '@lumina/data'

export default class OrgsController extends Controller {
  public async list() {
    const { ctx } = this
    try {
      const userId = ctx.state.user?.id
      if (!userId) {
        ctx.status = 401
        ctx.body = { success: false, code: 401, message: '未登录' }
        return
      }
      const list = await orgService.listUserOrgs(userId)
      ctx.body = { success: true, data: list }
    } catch (e) {
      if (isAppError(e)) {
        const err = e as AppError
        ctx.status = err.httpStatus || 400
        ctx.body = { success: false, code: err.bizCode || ctx.status, message: err.message, details: err.details }
      } else {
        ctx.body = { success: false, message: (e as Error).message || 'Unknown error' }
      }
    }
  }
}
