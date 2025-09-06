import { Context } from 'egg'
import { isAppError } from '@lumina/data'

/**
 * 全局错误处理中间件（AppError -> 统一HTTP与响应体）
 * - 捕获下游抛出的 AppError，设置 ctx.status = httpStatus，并返回 { success:false, code:bizCode, message }
 * - 其他错误交由默认 onerror 处理
 */
export default function errorHandler() {
  return async function appErrorHandler(ctx: Context, next: () => Promise<void>) {
    try {
      await next()
    } catch (err) {
      if (isAppError(err)) {
        const e = err
        ctx.status = e.httpStatus || 500
        ctx.body = { success: false, code: e.bizCode || ctx.status, message: e.message }
        return
      }
      // 透传非 AppError，交由框架 onerror 处理
      throw err
    }
  }
}
