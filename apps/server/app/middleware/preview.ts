import { Context } from 'egg'
import jwt from 'jsonwebtoken'

/**
 * 预览 Token 解析中间件（非强制）
 * - 从 header `x-preview-token` 或 query `token` 读取
 * - 使用 env PREVIEW_TOKEN_SECRET（否则回落到 app.keys）校验
 * - 校验失败不阻断请求，仅不注入 ctx.state.preview
 * - 控制器根据 ctx.state.preview 判定是否放宽 RBAC
 */
export default function previewToken() {
  return async function previewTokenMiddleware(ctx: Context, next: () => Promise<void>) {
    // 允许多来源获取分享 token（按优先级）：
    // 1) Header: x-preview-token
    // 2) Query: ?token=... 或 ?previewToken=...
    // 3) Authorization: Bearer <token>（仅当其 payload 含 rid 时才当作预览 token）
    const authHeader = ctx.get('authorization')
    const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ''
    const headerToken = ctx.get('x-preview-token')
    const queryToken = (ctx.query?.token as string | undefined) || (ctx.query?.previewToken as string | undefined)

    const candidates = [ headerToken, queryToken, bearer ].filter(Boolean) as string[]
    if (candidates.length === 0) {
      return await next()
    }

    const secret = process.env.PREVIEW_TOKEN_SECRET || ctx.app.config.keys
    let accepted = false
    for (const t of candidates) {
      try {
        const payload = jwt.verify(t, secret) as { rid?: string; ownerId?: number; orgId?: number; exp?: number }
        if (!payload?.rid) {
          // 非预览 token（例如登录态 Bearer），跳过
          continue
        }
        ctx.state.preview = {
          rid: payload.rid,
          ownerId: payload.ownerId,
          orgId: payload.orgId,
          exp: payload.exp,
        }
        accepted = true
        break
      } catch {
        // 尝试下一个候选
      }
    }
    if (!accepted) {
      // 未找到有效预览 token，按无 token 处理
      ctx.state.preview = null
    }
    await next()
  }
}
