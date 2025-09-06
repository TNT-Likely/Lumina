import { Controller } from 'egg'
import { userService } from '@lumina/data'

export default class MeController extends Controller {
  public async profile() {
    const { ctx } = this
    try {
      const userId = ctx.state.user?.id
      if (!userId) {
        ctx.status = 401
        ctx.body = { success: false, code: 401, message: '未登录' }
        return
      }
      const profile = await userService.getProfile(userId)
      ctx.body = { success: true, data: profile }
    } catch (e) {
      ctx.body = { success: false, message: (e as Error).message || 'Unknown error' }
    }
  }
}
