// src/lib/services/subscribe.ts
import { Subscribe } from '../models'
import { notifyService } from './notify'
import { getDashboardShareScreenshot } from './screenshot'
import { Op, type Order, type WhereOptions } from 'sequelize'
import { rbacService } from './rbac'
import type { OrgRole } from '../models/organizationMember'
import { ForbiddenError } from '../errors'
import type { ServiceContext } from '../types/context'

export interface SubscribeServiceQueryParams {
  id?: string
  name?: string
  dashboardId?: string
  notifyId?: string // 支持按某个通知方式过滤
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  orgId?: number
  currentUserId?: number
  role?: OrgRole | null
  // 内部使用：启动时调度器拉取订阅，可绕过权限过滤
  bypassAuth?: boolean
}

export interface ServicePaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  canCreate?: boolean
}

export const subscribeService = {
  /**
   * 获取订阅仪表盘分享页截图
   * @param id 订阅id
   * @param host 服务host
   */
  async getSubscriptionScreenshot ( id: number, host: string ): Promise<Buffer | null> {
    // 先查订阅，获取仪表盘id
    const subscribe = await Subscribe.findByPk( id )
    if ( subscribe == null || subscribe.dashboardId == null ) return null
    // dashboardId 字段需与订阅模型一致
    // 传递 orgId，便于公共预览接口进行组织范围校验；截图服务会在缺省时基于 PREVIEW_TOKEN_SECRET 动态签发预览令牌
    return await getDashboardShareScreenshot( subscribe.dashboardId, host, { orgId: subscribe.orgId ?? 1 } )
  },
  findAll: async ( params: SubscribeServiceQueryParams = {}, ctx?: ServiceContext ): Promise<ServicePaginatedResponse<Subscribe & { ownerId?: number; canWrite: boolean; canDelete: boolean }>> => {
    const {
      id,
      name,
      dashboardId,
      notifyId,
      page = 1,
      pageSize = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      orgId,
      currentUserId,
      role,
      bypassAuth
    } = params

    const effOrgId = ctx?.orgId ?? orgId
    const effUserId = ctx?.user?.id ?? currentUserId
    const effRole = ctx?.role ?? role

    const where: WhereOptions & Record<string, unknown> = {}
    if ( id ) where.id = id
    if ( name ) where.name = { [Op.like]: `%${name}%` }
    if ( dashboardId ) where.dashboardId = dashboardId
    if ( notifyId ) where.notifyIds = { [Op.contains]: [notifyId] }
    if ( effOrgId ) where.orgId = effOrgId

    const order: Order = [[sortBy, sortOrder.toUpperCase()]]
    const offset = ( page - 1 ) * pageSize

    // DB 侧可见性过滤（支持绕过）
    if ( !bypassAuth ) {
      ;( where as Record<string, unknown> )[Op.or as unknown as string] = [
        { visibility: 'public' },
        ...( effRole ? [{ visibility: 'org' }] as WhereOptions[] : [] ),
        ...( effUserId ? [{ visibility: 'private', ownerId: effUserId }] as WhereOptions[] : [] )
      ]
    }

    const { count, rows } = await Subscribe.findAndCountAll( {
      where,
      order,
      limit: pageSize,
      offset
    } )

    const data = rows.map( s => {
      const raw = ( s as unknown as { toJSON?: () => unknown } ).toJSON?.() ?? s
      const obj = raw as unknown as Subscribe & Record<string, unknown>
      const meta = { ownerId: obj.ownerId, visibility: ( obj.visibility ?? 'org' ) as 'private' | 'org' | 'public' }
      const canWrite = rbacService.canWrite( meta, effRole ?? null, effUserId )
      const canDelete = rbacService.canDelete( meta, effRole ?? null, effUserId )
      return { ...( obj as unknown as Record<string, unknown> ), ownerId: obj.ownerId, canWrite, canDelete } as unknown as ( Subscribe & { ownerId?: number; canWrite: boolean; canDelete: boolean } )
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
  },

  findById: async ( id: number, opts?: { bypassAuth?: boolean }, ctx?: ServiceContext ) => {
    const effOrgId = ctx?.orgId
    const effUserId2 = ctx?.user?.id
    const effRole2 = ctx?.role
    const bypassAuth = Boolean( opts?.bypassAuth )
    const s = await Subscribe.findOne( { where: { id, ...( effOrgId ? { orgId: effOrgId } : {} ) } } )
    if ( !s ) return null
    if ( bypassAuth ) return s
    const allowed = rbacService.canRead( { ownerId: s.ownerId, visibility: s.visibility ?? 'org' }, effRole2 ?? null, effUserId2 )
    if ( !allowed ) return null
    return s
  },

  create: async ( data: Subscribe & { orgId?: number, ownerId?: number, visibility?: 'private' | 'org' | 'public' }, ctx?: ServiceContext ) => {
    const effUserId = ctx?.user?.id
    const effRole = ctx?.role
    if ( !rbacService.canCreate( effRole ?? null, effUserId ) ) throw new ForbiddenError( 'Forbidden', 'SUBSCRIBE_FORBIDDEN' )
    return await Subscribe.create( data )
  },

  update: async ( id: number, data: Partial<Subscribe>, ctx?: ServiceContext ) => {
    const effOrgId = ctx?.orgId
    const effUserId = ctx?.user?.id
    const effRole = ctx?.role
    const subscribe = await Subscribe.findOne( { where: { id, ...( effOrgId ? { orgId: effOrgId } : {} ) } } )
    if ( subscribe ) {
      const can = rbacService.canWrite( { ownerId: subscribe.ownerId, visibility: subscribe.visibility ?? 'org' }, effRole ?? null, effUserId )
      if ( !can ) throw new ForbiddenError( 'Forbidden', 'SUBSCRIBE_FORBIDDEN' )
      return await subscribe.update( data )
    }
    return null
  },

  delete: async ( id: number, ctx?: ServiceContext ) => {
    const effOrgId = ctx?.orgId
    const effUserId = ctx?.user?.id
    const effRole = ctx?.role
    const subscribe = await Subscribe.findOne( { where: { id, ...( effOrgId ? { orgId: effOrgId } : {} ) } } )
    if ( subscribe ) {
      const can = rbacService.canDelete( { ownerId: subscribe.ownerId, visibility: subscribe.visibility ?? 'org' }, effRole ?? null, effUserId )
      if ( !can ) throw new ForbiddenError( 'Forbidden', 'SUBSCRIBE_FORBIDDEN' )
      await subscribe.destroy()
      return true
    }
    return false
  },

  // 启用/禁用订阅
  async toggleEnabled ( id: number, enabled: boolean, ctx?: ServiceContext ) {
    const effUserId = ctx?.user?.id
    const effRole = ctx?.role
    const subscribe = await Subscribe.findByPk( id )
    if ( !subscribe ) {
      return { success: false, message: 'Subscription not found' }
    }
    const can = rbacService.canWrite( { ownerId: subscribe.ownerId, visibility: subscribe.visibility ?? 'org' }, effRole ?? null, effUserId )
    if ( !can ) return { success: false, message: 'Forbidden' }
    await subscribe.update( { enabled } )
    return { success: true }
  },

  // 连通性测试：遍历所有 notifyIds，逐个调用 notifyService.testConnection
  /**
   * 连通性测试：遍历所有 notifyIds，逐个调用 notifyService.testConnection，并发送订阅截图
   * @param id 订阅id
   * @param host 服务host（如 http://localhost:3000）
   */
  async testConnection ( id: number, ctxOrHost?: ServiceContext | string ) {
    const isCtx = typeof ctxOrHost === 'object' && ctxOrHost !== null
    const host = isCtx ? ( process.env.NODE_ENV === 'production' ? 'http://localhost:80' : process.env.WEB_URL || 'http://localhost:5173' ) : ( ( ctxOrHost as string ) || ( process.env.NODE_ENV === 'production' ? 'http://localhost:80' : process.env.WEB_URL || 'http://localhost:5173' ) )
    const ctx = isCtx ? ( ctxOrHost as ServiceContext ) : undefined
    const effUserId = ctx?.user?.id
    const effRole = ctx?.role
    const subscribe = await Subscribe.findByPk( id )
    if ( !subscribe ) {
      return { success: false, message: 'Subscription not found' }
    }
    const allowed = rbacService.canRead( { ownerId: subscribe.ownerId, visibility: subscribe.visibility ?? 'org' }, effRole ?? null, effUserId )
    if ( !allowed ) return { success: false, message: 'Forbidden' }
    const notifyIds = Array.isArray( subscribe.notifyIds ) ? subscribe.notifyIds : []
    // 获取截图
    const screenshot: Buffer | null = await this.getSubscriptionScreenshot( id, host )

    const results: Array<{ notifyId: number | string, success: boolean, message?: string }> = []
    for ( const notifyId of notifyIds ) {
      // 组装图片为 markdown 格式 text
      const text = '订阅通道连通性测试'
      const instance = await notifyService.getInstance( notifyId )
      try {
        await instance?.sendImage( { images: [{ base64: screenshot?.toString( 'base64' ) }], title: text } )
        results.push( { notifyId, success: true, message: 'Image sent successfully' } )
      } catch ( error ) {
        results.push( { notifyId, success: false, message: ( error as Error ).toString() } )
        continue
      }
    }
    return { success: results.every( r => r.success ), results }
  }
}
