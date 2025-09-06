import { Dashboard, Subscribe } from '../models'
import { Op, type WhereOptions, type Order } from 'sequelize'
import { rbacService } from './rbac'
import type { OrgRole } from '../models/organizationMember'
import { AppError, ConflictError, ForbiddenError, NotFoundError } from '../errors'
import type { ServiceContext } from '../types/context'

export const dashboardService = {
  // 支持分页、条件、排序（增加 orgId 过滤）
  async list ( { id, name, creator, page = 1, pageSize = 20, sortBy, sortOrder, orgId, currentUserId, role }: {
    id?: number
    name?: string
    creator?: string
    page?: number
    pageSize?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
    orgId?: number
    currentUserId?: number
    role?: OrgRole | null
  }, ctx?: ServiceContext ) {
    const effOrgId = ctx?.orgId ?? orgId
    const effUserId = ctx?.user?.id ?? currentUserId
    const effRole = ctx?.role ?? role
    try {
      const baseFilters: WhereOptions = {
        ...( id ? { id } : {} ),
        ...( name ? { name: { [Op.like]: `%${name}%` } } : {} ),
        ...( creator ? { creator } : {} )
      }

      // 包含跨组织 public，同时保留当前组织内 org/private 的读取规则
      const orgScoped: WhereOptions = {
        ...( effOrgId ? { orgId: effOrgId } : {} ),
        [Op.or]: [
          ...( effRole ? [{ visibility: 'org' }] as WhereOptions[] : [] ),
          ...( effUserId ? [{ visibility: 'private', ownerId: effUserId }] as WhereOptions[] : [] )
        ]
      }

      const where: WhereOptions = {
        ...baseFilters,
        [Op.or]: [
          { visibility: 'public' },
          orgScoped
        ]
      }

      const total = await Dashboard.count( { where } )
      const rows = await Dashboard.findAll( {
        where,
        order: sortBy ? ( [[sortBy, ( sortOrder || 'ASC' ).toUpperCase()]] as Order ) : undefined,
        offset: ( page - 1 ) * pageSize,
        limit: pageSize
      } )

      const list = rows.map( d => {
        const raw = ( d as unknown as { toJSON?: () => unknown } ).toJSON?.() ?? d
        const obj = raw as unknown as Dashboard & Record<string, unknown>
        const meta = { ownerId: obj.ownerId, visibility: ( obj.visibility ?? 'org' ) as 'private' | 'org' | 'public' }
        const sameOrg = !effOrgId || Number( obj.orgId ) === Number( effOrgId )
        const canWrite = sameOrg && rbacService.canWrite( meta, effRole ?? null, effUserId )
        const canDelete = sameOrg && rbacService.canDelete( meta, effRole ?? null, effUserId )
        return { ...( obj as unknown as Record<string, unknown> ), ownerId: obj.ownerId, canWrite, canDelete }
      } )

      return {
        data: list,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil( total / pageSize )
        },
        canCreate: rbacService.canCreate( effRole ?? null, effUserId )
      }
    } catch ( e ) {
      throw new AppError( 'Failed to list dashboards', 500, 'DASHBOARD_LIST_FAILED', e )
    }
  },

  findById: async (
    id: string | number,
    opts?: { explainAuth?: boolean },
    ctx?: ServiceContext
  ) => {
    const explainAuth = Boolean( opts?.explainAuth )
    const effOrgId = ctx?.orgId
    const effUserId2 = ctx?.user?.id
    const effRole2 = ctx?.role
    // 允许跨组织读取 public；非 public 仍限制在当前 org
    const d = await Dashboard.findOne( { where: { id: Number( id ) } } )
    if ( !d ) {
      if ( explainAuth ) throw new NotFoundError( 'Dashboard not found', 'DASHBOARD_NOT_FOUND' )
      return null
    }
    if ( ( d.visibility ?? 'org' ) !== 'public' && effOrgId && d.orgId !== effOrgId ) {
      if ( explainAuth ) throw new ForbiddenError( 'Forbidden', 'DASHBOARD_FORBIDDEN' )
      return null
    }
    const allowed = rbacService.canRead( { ownerId: d.ownerId, visibility: d.visibility ?? 'org' }, effRole2 ?? null, effUserId2 )
    if ( allowed ) return d
    if ( explainAuth ) throw new ForbiddenError( 'Forbidden', 'DASHBOARD_FORBIDDEN' )
    return null
  },

  create: async (
    data: Dashboard & { orgId?: number, ownerId?: number, visibility?: 'private' | 'org' | 'public' },
    ctx?: ServiceContext
  ) => {
    const effUserId = ctx?.user?.id
    const effRole = ctx?.role
    if ( !rbacService.canCreate( effRole ?? null, effUserId ) ) throw new ForbiddenError( 'Forbidden', 'DASHBOARD_FORBIDDEN' )
    try {
      return await Dashboard.create( data )
    } catch ( e ) {
      throw new AppError( 'Failed to create dashboard', 500, 'DASHBOARD_CREATE_FAILED', e )
    }
  },

  update: async (
    id: string | number,
    data: Partial<Dashboard>,
    ctx?: ServiceContext
  ) => {
    const effOrgId = ctx?.orgId
    const effUserId = ctx?.user?.id
    const effRole = ctx?.role
    const dashboard = await Dashboard.findOne( { where: { id: Number( id ), ...( effOrgId ? { orgId: effOrgId } : {} ) } } )
    if ( dashboard ) {
      const can = rbacService.canWrite( { ownerId: dashboard.ownerId, visibility: dashboard.visibility ?? 'org' }, effRole ?? null, effUserId )
      if ( !can ) throw new ForbiddenError( 'Forbidden', 'DASHBOARD_FORBIDDEN' )
      try {
        const next = await dashboard.update( data )
        // 取消依赖资源可见性抬升：公开访问通过预览/公开接口处理，避免修改视图/数据集/数据源的权限
        return next
      } catch ( e ) {
        throw new AppError( 'Failed to update dashboard', 500, 'DASHBOARD_UPDATE_FAILED', e )
      }
    }
    return null
  },

  delete: async (
    id: string | number,
    ctx?: ServiceContext
  ) => {
    const effOrgId = ctx?.orgId
    const effUserId = ctx?.user?.id
    const effRole = ctx?.role
    const dashboard = await Dashboard.findOne( { where: { id: Number( id ), ...( effOrgId ? { orgId: effOrgId } : {} ) } } )
    if ( dashboard ) {
      const can = rbacService.canDelete( { ownerId: dashboard.ownerId, visibility: dashboard.visibility ?? 'org' }, effRole ?? null, effUserId )
      if ( !can ) throw new ForbiddenError( 'Forbidden', 'DASHBOARD_FORBIDDEN' )
      // 依赖校验：订阅引用
      const dep = await Subscribe.count( { where: { dashboardId: Number( id ), ...( effOrgId ? { orgId: effOrgId } : {} ) } } )
      if ( dep > 0 ) {
        throw new ConflictError( '该看板存在关联的订阅，无法删除', 'DASHBOARD_IN_USE' )
      }
      try {
        await dashboard.destroy()
        return true
      } catch ( e ) {
        throw new AppError( 'Failed to delete dashboard', 500, 'DASHBOARD_DELETE_FAILED', e )
      }
    }
    return false
  }
}
