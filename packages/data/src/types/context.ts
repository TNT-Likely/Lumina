// packages/data/src/types/context.ts
import type { Transaction } from 'sequelize'
import type { OrgRole } from '../models/organizationMember'

/**
 * Service 调用上下文，承载调用者与作用域信息，避免在服务方法上传递过多散乱的参数。
 */
export interface ServiceContext {
  /** 与 server 保持一致：ctx.state.user（id/username） */
  user?: { id: number; username?: string } | null
  /** 与 server 保持一致：ctx.state.orgId */
  orgId?: number | null
  /** 由应用层计算：用户在 org 下的角色 */
  role?: OrgRole | null
  /** 内部系统调用（如订阅任务、离线任务） */
  isInternal?: boolean
  /** 与 server 保持一致：ctx.state.preview（分享预览上下文） */
  preview?: { rid?: string | null; ownerId?: number | null; orgId?: number | null; exp?: number | null } | null
  /** 可选：事务透传 */
  txn?: Transaction | null
}

export function fromPartial ( partial?: Partial<ServiceContext> ): ServiceContext {
  return {
    user: partial?.user ?? null,
    orgId: partial?.orgId ?? null,
    role: partial?.role ?? null,
    isInternal: !!partial?.isInternal,
    preview: partial?.preview ?? null,
    txn: partial?.txn ?? null
  }
}
