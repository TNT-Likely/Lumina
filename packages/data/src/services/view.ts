import { View, Dataset, Datasource, Dashboard } from '../models'
import { AppError, ForbiddenError, NotFoundError, ConflictError } from '../errors'
import { datasetService, type QueryExecutionParams, type QueryResult } from './dataset'
import { rbacService } from './rbac'
import type { OrgRole } from '../models/organizationMember'
import { Op, type Order, type WhereOptions, type Includeable } from 'sequelize'
import { type ServicePaginatedResponse } from './datasource'
import type { ServiceContext } from '../types/context'

export interface ViewServiceQueryParams {
  id?: number
  name?: string
  datasetId?: number
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  orgId?: number
  currentUserId?: number
  role?: OrgRole | null
}

export interface ViewDataRequest {
  filters?: QueryExecutionParams['filters']
  parameters?: Record<string, string | number | boolean | null | Date | undefined>
  pagination?: {
    page: number
    pageSize: number
  }
}

export interface ViewDataResponse {
  data: Array<Record<string, unknown>>
  totalCount: number
  executionTime: number
  sql?: string
  columns: Array<{
    name: string
    type: string
    isDimension: boolean
    isMetric: boolean
  }>
}

export const viewService = {
  findAll: async ( params?: ViewServiceQueryParams, ctx?: ServiceContext ): Promise<ServicePaginatedResponse<View & { ownerId?: number; canWrite: boolean; canDelete: boolean }>> => {
    const {
      id,
      name,
      datasetId,
      page = 1,
      pageSize = 10,
      orgId,
      currentUserId,
      role
    } = params || {}

    const effOrgId = ctx?.orgId ?? orgId
    const effUserId = ctx?.user?.id ?? currentUserId
    const effRole = ctx?.role ?? role

    const where: WhereOptions = {}
    const include: Includeable[] = []

    // 构建查询条件
    if ( id ) {
      where.id = id
    }

    if ( name ) {
      where.name = {
        [Op.like]: `%${name}%`
      }
    }

    if ( datasetId ) {
      where.datasetId = datasetId
    }
    // 注意：不在顶层强制 orgId 过滤，以允许跨组织读取 public 视图

    const order: Order = [['createdAt', 'DESC']]
    const offset = ( page - 1 ) * pageSize

    try {
      // 可见性：跨组织 public + 当前组织内 org/private
      const orgScoped: WhereOptions = {
        ...( effOrgId ? { orgId: effOrgId } : {} ),
        [Op.or]: [
          ...( effRole ? [{ visibility: 'org' }] as WhereOptions[] : [] ),
          ...( effUserId ? [{ visibility: 'private', ownerId: effUserId }] as WhereOptions[] : [] )
        ]
      }
      ;( where as Record<string, unknown> )[Op.or as unknown as string] = [
        { visibility: 'public' },
        orgScoped
      ]

      const { count, rows } = await View.findAndCountAll( {
        where,
        include,
        order,
        limit: pageSize,
        offset,
        distinct: true // 防止关联查询导致的重复计数
      } )

      const data = rows.map( v => {
        const raw = ( v as unknown as { toJSON?: () => unknown } ).toJSON?.() ?? v
        const obj = raw as unknown as View & Record<string, unknown>
        const meta = { ownerId: obj.ownerId, visibility: ( obj.visibility ?? 'org' ) as 'private' | 'org' | 'public' }
        const sameOrg = !effOrgId || Number( obj.orgId ) === Number( effOrgId )
        const canWrite = sameOrg && rbacService.canWrite( meta, effRole ?? null, effUserId )
        const canDelete = sameOrg && rbacService.canDelete( meta, effRole ?? null, effUserId )
        return { ...( obj as unknown as Record<string, unknown> ), ownerId: obj.ownerId, canWrite, canDelete } as unknown as ( View & { ownerId?: number; canWrite: boolean; canDelete: boolean } )
      } )

      return {
        data,
        pagination: {
          page,
          pageSize,
          total: count,
          totalPages: Math.ceil( count / pageSize )
        },
        canCreate: rbacService.canCreate( effRole ?? null, effUserId )
      }
    } catch ( error ) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      throw new AppError( `Failed to fetch views: ${message}`, 500, 'VIEW_LIST_FAILED' )
    }
  },

  findById: async ( id: string | number, opts?: { explainAuth?: boolean }, ctx?: ServiceContext ) => {
    const explainAuth = Boolean( opts?.explainAuth )
    const effOrgId = ctx?.orgId
    const effUserId = ctx?.user?.id
    const effRole2 = ctx?.role
    // validate id
    if ( !Number.isFinite( Number( id ) ) ) {
      if ( explainAuth ) throw new NotFoundError( 'View not found', 'VIEW_NOT_FOUND', { id } )
      return null
    }
    // 允许跨组织读取 public；非 public 必须在当前组织
    const v = await View.findOne( { where: { id: Number( id ) } } )
    if ( !v ) {
      if ( explainAuth ) throw new NotFoundError( 'View not found', 'VIEW_NOT_FOUND', { id } )
      return null
    }
    if ( ( v.visibility ?? 'org' ) !== 'public' && effOrgId && v.orgId !== effOrgId ) {
      if ( explainAuth ) throw new ForbiddenError( 'Forbidden', 'VIEW_FORBIDDEN', { id } )
      return null
    }
    const allowed = rbacService.canRead( { ownerId: v.ownerId, visibility: v.visibility ?? 'org' }, effRole2 ?? null, effUserId )
    if ( allowed ) return v
    if ( explainAuth ) throw new ForbiddenError( 'Forbidden', 'VIEW_FORBIDDEN', { id } )
    return null
  },

  create: async ( data: View & { orgId?: number, ownerId?: number, visibility?: 'private' | 'org' | 'public' }, ctx?: ServiceContext ) => {
    const effUserId = ctx?.user?.id
    const effRole = ctx?.role
    if ( !rbacService.canCreate( effRole ?? null, effUserId ) ) throw new ForbiddenError( 'Forbidden', 'VIEW_FORBIDDEN' )
    const instance = View.build( data )
    // Validate or modify instance as needed
    try {
      return await instance.save()
    } catch ( e ) {
      const msg = e instanceof Error ? e.message : String( e )
      throw new AppError( `Failed to create view: ${msg}`, 500, 'VIEW_CREATE_FAILED' )
    }
  },

  update: async ( id: string | number, data: Partial<View>, ctx?: ServiceContext ) => {
    const effOrgId = ctx?.orgId
    const effUserId = ctx?.user?.id
    const effRole = ctx?.role
    const view = await View.findOne( { where: { id: Number( id ), ...( effOrgId ? { orgId: effOrgId } : {} ) } } )
    if ( !view ) return null
    const can = rbacService.canWrite( { ownerId: view.ownerId, visibility: view.visibility ?? 'org' }, effRole ?? null, effUserId )
    if ( !can ) throw new ForbiddenError( 'Forbidden', 'VIEW_FORBIDDEN', { id } )
    try {
      return await view.update( data )
    } catch ( e ) {
      const msg = e instanceof Error ? e.message : String( e )
      throw new AppError( `Failed to update view: ${msg}`, 500, 'VIEW_UPDATE_FAILED' )
    }
  },

  delete: async ( id: string | number, ctx?: ServiceContext ) => {
    const effOrgId = ctx?.orgId
    const effUserId = ctx?.user?.id
    const effRole = ctx?.role
    const view = await View.findOne( { where: { id: Number( id ), ...( effOrgId ? { orgId: effOrgId } : {} ) } } )
    if ( !view ) return false
    const can = rbacService.canDelete( { ownerId: view.ownerId, visibility: view.visibility ?? 'org' }, effRole ?? null, effUserId )
    if ( !can ) throw new ForbiddenError( 'Forbidden', 'VIEW_FORBIDDEN', { id } )

    // 依赖校验：检查是否被任何看板的组件引用（dashboard.config JSON 中的 viewId）
    const dashboards = await Dashboard.findAll( {
      where: effOrgId ? { orgId: effOrgId } : {},
      attributes: ['id', 'config']
    } )
    const vid = Number( id )
    const inUse = dashboards.some( d => {
      const cfg = d.get( 'config' ) as unknown
      if ( !cfg || typeof cfg !== 'object' ) return false
      try {
        const comps = ( cfg as { components?: Array<{ config?: { viewId?: number } }> } ).components || []
        return comps.some( c => Number( ( c?.config as { viewId?: number } | undefined )?.viewId ) === vid )
      } catch { return false }
    } )
    if ( inUse ) {
      throw new ConflictError( 'View is referenced by dashboards', 'VIEW_IN_USE', { id } )
    }

    try {
      await view.destroy()
    } catch ( e ) {
      const msg = e instanceof Error ? e.message : String( e )
      throw new AppError( `Failed to delete view: ${msg}`, 500, 'VIEW_DELETE_FAILED' )
    }
    return true
  },

  // 新增：获取视图数据（合并视图配置与前端参数），纯 ctx 模式
  async getData ( viewId: number, queryParams: QueryExecutionParams, ctx?: ServiceContext ): Promise<QueryResult> {
    const effOrgId = ctx?.orgId
    const effUserId = ctx?.user?.id
    const effRole = ctx?.role
    if ( !Number.isFinite( Number( viewId ) ) ) {
      throw new AppError( 'Invalid view id', 400, 'INVALID_VIEW_ID' )
    }
    const view = await View.findOne( { where: { id: viewId } } )
    if ( !view ) throw new NotFoundError( 'View not found', 'VIEW_NOT_FOUND', { viewId } )
    if ( ( view.visibility ?? 'org' ) !== 'public' && effOrgId && view.orgId !== effOrgId ) throw new ForbiddenError( 'Forbidden', 'VIEW_FORBIDDEN', { viewId, orgId: effOrgId } )
    const allowed = rbacService.canRead( { ownerId: view.ownerId, visibility: view.visibility ?? 'org' }, effRole ?? null, effUserId )
    if ( !allowed ) throw new ForbiddenError( 'Forbidden', 'VIEW_FORBIDDEN', { viewId } )
    const datasetId = view.datasetId
    if ( !datasetId ) throw new NotFoundError( 'View has no datasetId', 'VIEW_NO_DATASET', { viewId } )
    // 读取视图配置（安全获取 chartConfig）
    const cfg = view.config as unknown
    const config = ( cfg && typeof cfg === 'object' && 'chartConfig' in ( cfg as Record<string, unknown> )
      ? ( ( cfg as { chartConfig?: Partial<QueryExecutionParams> } ).chartConfig ?? {} )
      : {} ) as Partial<QueryExecutionParams>

    // 合并参数，前端参数优先生效
    const mergedParams: QueryExecutionParams = {
      dimensions: queryParams.dimensions ?? config.dimensions ?? [],
      metrics: queryParams.metrics ?? config.metrics ?? [],
      filters: queryParams.filters ?? config.filters ?? [],
      limit: queryParams.limit ?? config.limit,
      offset: queryParams.offset ?? config.offset,
      orderBy: queryParams.orderBy ?? config.orderBy
    }
    // 严格模式：如果既没有维度也没有指标，返回 400，要求前端显式指定至少一个维度或指标
    if ( ( mergedParams.dimensions == null || mergedParams.dimensions.length === 0 ) && ( mergedParams.metrics == null || mergedParams.metrics.length === 0 ) ) {
      throw new AppError( 'At least one dimension or metric must be specified', 400, 'MISSING_DIM_OR_METRIC' )
    }
    // 若视图为 public 且外部未传入角色，则默认以 VIEWER 身份执行数据查询，
    // 以支持 public 视图在无 token 的公开页面直接读取数据（仍为只读权限）。
    const isPublicView = ( view.visibility ?? 'org' ) === 'public'
    const effRole2: OrgRole | null = effRole ?? ( isPublicView ? 'VIEWER' : null )
    const effUserId2: number | null | undefined = ( effUserId == null && isPublicView ) ? ( view.ownerId ?? null ) : effUserId
    return await datasetService.executeQuery(
      datasetId,
      mergedParams,
      { orgId: effOrgId, user: { id: effUserId2 ?? undefined, username: undefined }, role: effRole2 } as ServiceContext,
      undefined
    )
  }
}
