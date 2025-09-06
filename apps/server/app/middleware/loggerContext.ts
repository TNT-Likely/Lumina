import { Context } from 'egg'
import { getLogger, runWithContext } from '@lumina/logger'
import { randomUUID } from 'node:crypto'

export default function loggerContext() {
  return async function loggerCtx(ctx: Context, next: () => Promise<void>) {
    const reqId = ctx.get('x-request-id') || randomUUID()
    ctx.set('x-request-id', reqId)

    const userId = ctx.state.user?.id
    const orgId = ctx.state.org?.id

    await runWithContext({ requestId: reqId, userId, orgId }, async () => {
      const logger = getLogger()
      try {
        await next()
        // 只在失败（>=400）时记录
        if ((ctx.status || 500) >= 400) {
          const b = ctx.body as unknown
          const bodyObj: Record<string, unknown> | undefined = (b && typeof b === 'object') ? b as Record<string, unknown> : undefined
          const errorMsg = bodyObj && typeof bodyObj.message === 'string' ? (bodyObj.message as string) : ctx.message
          logger.error({
            path: ctx.path,
            method: ctx.method,
            status: ctx.status || 500,
            time: new Date().toISOString(),
            userId,
            orgId,
            error: errorMsg,
          })
        }
      } catch (err) {
        const status = ctx.status && ctx.status >= 400 ? ctx.status : 500
        const errorMsg = err instanceof Error ? err.message : String(err)
        logger.error({
          path: ctx.path,
          method: ctx.method,
          status,
          time: new Date().toISOString(),
          userId,
          orgId,
          error: errorMsg,
        })
        throw err
      }
    })
  }
}
