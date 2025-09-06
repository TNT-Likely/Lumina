// src/lib/services/notify.ts
import { Notify } from '../models'
import { Notify as NotifyFactory, type EmailProperties, type Instance, NotifyChannel, type TelegramProperties, type SlackProperties, type LarkProperties, type DiscordProperties, type DingRobotProperties } from '@lumina/notify'
import { Op, type Order, type WhereOptions } from 'sequelize'
import type { NotificationConfig } from '@lumina/types'
import { rbacService } from './rbac'
import type { OrgRole } from '../models/organizationMember'
import { AppError, ForbiddenError, NotFoundError } from '../errors'
import type { ServiceContext } from '../types/context'

export interface NotifyServiceQueryParams {
  id?: number
  name?: string
  type?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  orgId?: number
  currentUserId?: number
  role?: OrgRole | null
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

export const notifyService = {
  /**
   * 获取指定 id 的通知实例，优先用数据库配置，缺省项用 process.env 补全
   */
  getInstance: async ( id: number ):Promise<Instance|null> => {
    const notify = await Notify.findByPk( id )
    if ( notify == null ) return null
    if ( notify.type === 'email' ) {
      const props: EmailProperties = {
        host: process.env.MAIL_HOST || '',
        port: ( process.env.MAIL_PORT ? Number( process.env.MAIL_PORT ) : 465 ),
        secure: process.env.MAIL_SECURE === 'true',
        from: process.env.MAIL_FROM || '',
        user: process.env.MAIL_USER || '',
        pass: process.env.MAIL_PASS || '',
        to: notify.config.email?.to as string
      }
      return NotifyFactory( { type: NotifyChannel.Email, properties: props } )
    }
    // 其他类型：直接使用配置中的对应块
    if ( notify.type === 'slack' ) {
      const props = ( notify.config?.slack ?? {} ) as unknown as SlackProperties
      return NotifyFactory( { type: NotifyChannel.Slack, properties: props } )
    }
    if ( notify.type === 'telegram' ) {
      const props = ( notify.config?.telegram ?? {} ) as unknown as TelegramProperties
      return NotifyFactory( { type: NotifyChannel.Telegram, properties: props } )
    }
    if ( notify.type === 'lark' ) {
      const props = ( notify.config?.lark ?? {} ) as unknown as LarkProperties
      return NotifyFactory( { type: NotifyChannel.Lark, properties: props } )
    }
    if ( notify.type === 'discord' ) {
      const props = ( notify.config?.discord ?? {} ) as unknown as DiscordProperties
      return NotifyFactory( { type: NotifyChannel.Discord, properties: props } )
    }
    if ( notify.type === 'ding' ) {
      const props = ( notify.config?.ding ?? {} ) as unknown as DingRobotProperties
      return NotifyFactory( { type: NotifyChannel.Ding_Robot, properties: props } )
    }
    throw new AppError( 'Unsupported notification type: ' + String( notify.type ), 400, 'NOTIFY_UNSUPPORTED' )
  },

  findAll: async ( params: NotifyServiceQueryParams = {}, ctx?: ServiceContext ): Promise<ServicePaginatedResponse<Notify & { ownerId?: number; canWrite: boolean; canDelete: boolean }>> => {
    const {
      id,
      name,
      type,
      page = 1,
      pageSize = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      orgId,
      currentUserId,
      role
    } = params

    const effOrgId = ctx?.orgId ?? orgId
    const effUserId = ctx?.user?.id ?? currentUserId
    const effRole = ctx?.role ?? role

    const where: WhereOptions = {}
    if ( id ) ( where as Record<string, unknown> ).id = id
    if ( name ) ( where as Record<string, unknown> ).name = { [Op.like]: `%${name}%` }
    if ( type ) ( where as Record<string, unknown> ).type = type
    if ( effOrgId ) ( where as Record<string, unknown> ).orgId = effOrgId

    const order: Order = [[sortBy, sortOrder.toUpperCase()]]
    const offset = ( page - 1 ) * pageSize

    // DB 侧可见性过滤，保证 total 精确
    ;( where as Record<string, unknown> )[Op.or as unknown as string] = [
      { visibility: 'public' },
      ...( effRole ? [{ visibility: 'org' }] as WhereOptions[] : [] ),
      ...( effUserId ? [{ visibility: 'private', ownerId: effUserId }] as WhereOptions[] : [] )
    ]

    const { count, rows } = await Notify.findAndCountAll( {
      where,
      order,
      limit: pageSize,
      offset
    } )

    const data = rows.map( n => {
      const raw = ( n as unknown as { toJSON?: () => unknown } ).toJSON?.() ?? n
      const obj = raw as unknown as Notify & Record<string, unknown>
      const meta = { ownerId: obj.ownerId, visibility: ( obj.visibility ?? 'org' ) as 'private' | 'org' | 'public' }
      const canWrite = rbacService.canWrite( meta, effRole ?? null, effUserId )
      const canDelete = rbacService.canDelete( meta, effRole ?? null, effUserId )
      return { ...( obj as unknown as Record<string, unknown> ), ownerId: obj.ownerId, canWrite, canDelete } as unknown as ( Notify & { ownerId?: number; canWrite: boolean; canDelete: boolean } )
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

  findById: async ( id: number, ctx?: ServiceContext ) => {
    const effOrgId = ctx?.orgId
    const effUserId = ctx?.user?.id
    const effRole = ctx?.role
    const where: WhereOptions = { id }
    if ( effOrgId ) ( where as Record<string, unknown> ).orgId = effOrgId
    const n = await Notify.findOne( { where } )
    if ( !n ) return null
    const allowed = rbacService.canRead( { ownerId: n.ownerId, visibility: n.visibility ?? 'org' }, effRole ?? null, effUserId )
    if ( !allowed ) return null
    return n
  },

  create: async ( data: Notify & { orgId?: number, ownerId?: number, visibility?: 'private' | 'org' | 'public' }, ctx?: ServiceContext ) => {
    const effUserId = ctx?.user?.id
    const effRole = ctx?.role
    if ( !rbacService.canCreate( effRole ?? null, effUserId ) ) throw new ForbiddenError( 'Forbidden', 'NOTIFY_FORBIDDEN' )
    return await Notify.create( data )
  },
  update: async ( id: number, data: Partial<Notify>, ctx?: ServiceContext ) => {
    const effOrgId = ctx?.orgId
    const effUserId = ctx?.user?.id
    const effRole = ctx?.role
    const notify = await Notify.findOne( { where: { id, ...( effOrgId ? { orgId: effOrgId } : {} ) } } )
    if ( notify ) {
      const can = rbacService.canWrite( { ownerId: notify.ownerId, visibility: notify.visibility ?? 'org' }, effRole ?? null, effUserId )
      if ( !can ) throw new ForbiddenError( 'Forbidden', 'NOTIFY_FORBIDDEN' )
      return await notify.update( data )
    }
    return null
  },
  delete: async ( id: number, ctx?: ServiceContext ) => {
    const effOrgId = ctx?.orgId
    const effUserId = ctx?.user?.id
    const effRole = ctx?.role
    const notify = await Notify.findOne( { where: { id, ...( effOrgId ? { orgId: effOrgId } : {} ) } } )
    if ( notify ) {
      const can = rbacService.canDelete( { ownerId: notify.ownerId, visibility: notify.visibility ?? 'org' }, effRole ?? null, effUserId )
      if ( !can ) throw new ForbiddenError( 'Forbidden', 'NOTIFY_FORBIDDEN' )
      await notify.destroy()
      return true
    }
    return false
  },

  // 测试通知连通性
  /**
   * 测试通知连通性，text 由adapter处理
   * @param id 通知id
   * @param text 测试内容
   */
  /**
   * 测试通知连通性
   * @param id 通知id
   * @param type 测试类型 text/image，默认 text
   */
  testConnection: async ( id: number, type: 'text' | 'image' = 'text', ctx?: ServiceContext ) => {
    const effUserId = ctx?.user?.id
    const effRole = ctx?.role
    // 权限校验
    const notify = await Notify.findByPk( id )
    if ( !notify ) return { success: false, message: 'Notification not found' }
    const allowed = rbacService.canRead( { ownerId: notify.ownerId, visibility: notify.visibility ?? 'org' }, effRole ?? null, effUserId )
    if ( !allowed ) return { success: false, message: 'Forbidden' }
    const instance = await notifyService.getInstance( id )
    if ( !instance ) return { success: false, message: 'Notification not found' }
    try {
      if ( type === 'image' ) {
        // 发送一张默认图片
        await instance.sendImage( {
          images: [
            { url: 'https://pub-8df06fb0382d45a698804819653c9abd.r2.dev/lumina.png' },
            { base64: 'data:image/png;base64,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' }
          ],
          title: '测试图片',
          text: '测试图片消息'
        } )
      } else {
        await instance.sendText( '测试消息' )
      }
    } catch ( error ) {
      return { success: false, message: ( error as Error ).toString() }
    }
    return { success: true, message: type === 'image' ? '测试图片发送成功' : '测试消息发送成功' }
  }
}
