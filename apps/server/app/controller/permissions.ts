import { Controller } from 'egg'
import { rbacService, dashboardService, viewService, datasetService, datasourceService, isAppError, AppError } from '@lumina/data'

type ResourceType = 'dashboard' | 'view' | 'dataset' | 'datasource'

export default class PermissionsController extends Controller {
  /**
   * POST /api/permissions:batch
   * body: { items: Array<{ type: ResourceType, id: number }> }
   * return: { success: true, data: Array<{ type: ResourceType, id: number, read: boolean, write: boolean, delete: boolean }> }
   */
  async batchCheck() {
    const { ctx } = this
    try {
      const { items } = (ctx.request.body || {}) as { items?: Array<{ type: ResourceType, id: number }> }
      const orgId = ctx.state.orgId as number | undefined
      const userId = (ctx.state.user?.id ?? null) as number | null
      const role = await rbacService.getUserRoleInOrg(userId ?? undefined, orgId ?? undefined)
      const list = Array.isArray(items) ? items : []


      const result: Array<{ type: ResourceType, id: number, read: boolean, write: boolean, delete: boolean }> = []
      for (const it of list) {
        if (!it || !it.type || !Number.isFinite(Number(it.id))) continue
        const id = Number(it.id)
        try {
          // 读取基础元信息（ownerId, visibility）用于判定
          let meta: { ownerId?: number | null, visibility?: 'private' | 'org' | 'public' | null } | null = null
          switch (it.type) {
          case 'dashboard': {
            const d = await dashboardService.findById(id, { explainAuth: false }, { ...ctx.state, role } as import('@lumina/data').ServiceContext)
            if (d) meta = { ownerId: d.ownerId as number | undefined, visibility: (d.visibility ?? 'org') as 'private' | 'org' | 'public' }
            break
          }
          case 'view': {
            const v = await viewService.findById(id, { explainAuth: false }, { ...ctx.state, role } as import('@lumina/data').ServiceContext)
            if (v) meta = { ownerId: v.ownerId as number | undefined, visibility: (v.visibility ?? 'org') as 'private' | 'org' | 'public' }
            break
          }
          case 'dataset': {
            const ds = await datasetService.findById(id, { includeSource: false, explainAuth: false }, { ...ctx.state, role } as import('@lumina/data').ServiceContext)
            if (ds) meta = { ownerId: ds.ownerId as number | undefined, visibility: (ds.visibility ?? 'org') as 'private' | 'org' | 'public' }
            break
          }
          case 'datasource': {
            const ds = await datasourceService.findById(id, { explainAuth: false }, { ...ctx.state, role } as import('@lumina/data').ServiceContext)
            if (ds) {
              const ownerId = (ds as unknown as { ownerId?: number }).ownerId as number | undefined
              const visibility = ((ds as unknown as { visibility?: 'private' | 'org' | 'public' }).visibility ?? 'org') as 'private' | 'org' | 'public'
              meta = { ownerId, visibility }
            }
            break
          }
          default: {
            // 未知类型，视为无权限
            meta = null
            break
          }
          }
          if (!meta) {
            result.push({ type: it.type, id, read: false, write: false, delete: false })
            continue
          }
          const read = rbacService.canRead(meta, role ?? null, userId ?? undefined)
          const write = rbacService.canWrite(meta, role ?? null, userId ?? undefined)
          const del = rbacService.canDelete(meta, role ?? null, userId ?? undefined)
          result.push({ type: it.type, id, read, write, delete: del })
        } catch {
          result.push({ type: it.type, id, read: false, write: false, delete: false })
        }
      }

      ctx.body = { success: true, data: result }
    } catch (e) {
      if (isAppError(e)) {
        const err = e as AppError
        ctx.status = err.httpStatus || 400
        ctx.body = { success: false, code: err.bizCode || ctx.status, message: err.message, details: err.details }
      } else {
        throw e
      }
    }
  }
}
