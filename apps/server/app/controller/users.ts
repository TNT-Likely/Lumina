import { Controller } from 'egg'
import { userService } from '@lumina/data'

export default class UsersController extends Controller {
  public async search() {
    const { ctx } = this
    try {
      const q = String(ctx.query.q || '')
      const list = await userService.searchUsers(q, 20)
      ctx.body = { success: true, data: list }
    } catch (e) {
      ctx.body = { success: false, message: (e as Error).message || 'Unknown error' }
    }
  }
}
