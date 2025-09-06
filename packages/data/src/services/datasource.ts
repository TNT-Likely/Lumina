// src/lib/services/datasource.ts
import { Datasource, Dataset } from '../models'
import { Op, type Order, type WhereOptions } from 'sequelize'
import { rbacService } from './rbac'
import type { OrgRole } from '../models/organizationMember'
import { QueryEngine, type QueryEngineType } from '@lumina/query-engine'
import { AppError, ConflictError, ForbiddenError, NotFoundError } from '../errors'
import type { ServiceContext } from '../types/context'

export interface DatasourceServiceQueryParams {
  id?: number
  name?: string
  type?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  createdAfter?: string
  createdBefore?: string
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

export const datasourceService = {
  findAll: async (
    params?: DatasourceServiceQueryParams & { orgId?: number; currentUserId?: number; role?: OrgRole | null },
    ctx?: ServiceContext
  ): Promise<ServicePaginatedResponse<Datasource & { ownerId?: number; canWrite: boolean; canDelete: boolean }>> => {
    const {
      id,
      name,
      type,
      page = 1,
      pageSize = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      createdAfter,
      createdBefore,
      currentUserId,
      role
    } = params || {}

    const effOrgId = ctx?.orgId ?? params?.orgId
    const effUserId = ctx?.user?.id ?? currentUserId
    const effRole = ctx?.role ?? role

    // 构建查询条件
    const where: WhereOptions = {}
    // 不在顶层强制 orgId，允许跨组织 public 资源出现在列表

    if ( id ) {
      where.id = id
    }

    if ( name ) {
      where.name = {
        [Op.like]: `%${name}%`
      }
    }

    if ( type ) {
      where.type = type
    }

    if ( createdAfter || createdBefore ) {
      where.createdAt = {
        ...( createdAfter ? { [Op.gte]: new Date( createdAfter ) } : {} ),
        ...( createdBefore ? { [Op.lte]: new Date( createdBefore ) } : {} )
      }
    }

    // 构建排序条件
    const order: Order = [[sortBy, sortOrder.toUpperCase()]]

    // 计算分页
    const offset = ( page - 1 ) * pageSize

    try {
      // 可见性：跨组织 public + 当前组织 org/private
      where[Op.or as unknown as string] = [
        { visibility: 'public' },
        {
          ...( effOrgId ? { orgId: effOrgId } : {} ),
          [Op.or]: [
            ...( effRole ? [{ visibility: 'org' }] as WhereOptions[] : [] ),
            ...( effUserId ? [{ visibility: 'private', ownerId: effUserId }] as WhereOptions[] : [] )
          ]
        }
      ]

      const { count, rows } = await Datasource.findAndCountAll( {
        where,
        order,
        limit: pageSize,
        offset
      } )

      const data = rows.map( ds => {
        const raw = ( ds as unknown as { toJSON?: () => unknown } ).toJSON?.() ?? ds
        const obj = raw as unknown as Datasource & Record<string, unknown>
        const meta = { ownerId: obj.ownerId, visibility: ( obj.visibility ?? 'org' ) as 'private' | 'org' | 'public' }
        const sameOrg = !effOrgId || Number( obj.orgId ) === Number( effOrgId )
        const canWrite = sameOrg && rbacService.canWrite( meta, effRole ?? null, effUserId )
        const canDelete = sameOrg && rbacService.canDelete( meta, effRole ?? null, effUserId )
        return { ...( obj as unknown as Record<string, unknown> ), ownerId: obj.ownerId, canWrite, canDelete } as unknown as ( Datasource & { ownerId?: number; canWrite: boolean; canDelete: boolean } )
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
      throw new AppError( 'Failed to fetch datasources', 500, 'DATASOURCE_LIST_FAILED', error )
    }
  },

  findById: async (
    id: number,
    opts?: { explainAuth?: boolean },
    ctx?: ServiceContext
  ) => {
    const explainAuth = Boolean( opts?.explainAuth )
    const effOrgId = ctx?.orgId
    const effUserId = ctx?.user?.id
    const effRole2 = ctx?.role
    const where: WhereOptions = { id }
    const ds = await Datasource.findOne( { where } )
    if ( !ds ) {
      if ( explainAuth ) throw new NotFoundError( 'Datasource not found', 'DATASOURCE_NOT_FOUND' )
      return null
    }
    if ( ( ds.visibility ?? 'org' ) !== 'public' && effOrgId && ds.orgId !== effOrgId ) {
      if ( explainAuth ) throw new ForbiddenError( 'Forbidden', 'DATASOURCE_FORBIDDEN' )
      return null
    }
    const allowed = rbacService.canRead( { ownerId: ds.ownerId, visibility: ds.visibility ?? 'org' }, effRole2 ?? null, effUserId )
    if ( allowed ) return ds
    if ( explainAuth ) throw new ForbiddenError( 'Forbidden', 'DATASOURCE_FORBIDDEN' )
    return null
  },

  create: async ( data: Datasource & { orgId?: number; ownerId?: number }, ctx?: ServiceContext ) => {
    const effUserId = ctx?.user?.id
    const effRole = ctx?.role
    if ( !rbacService.canCreate( effRole ?? null, effUserId ) ) throw new ForbiddenError( 'Forbidden', 'DATASOURCE_FORBIDDEN' )
    try {
      return await Datasource.create( data )
    } catch ( e ) {
      throw new AppError( 'Failed to create datasource', 500, 'DATASOURCE_CREATE_FAILED', e )
    }
  },

  update: async ( id: number, data: Partial<Datasource>, ctx?: ServiceContext ) => {
    const effOrgId = ctx?.orgId
    const effUserId = ctx?.user?.id
    const effRole = ctx?.role
    const where: WhereOptions = { id }
    if ( effOrgId ) where.orgId = effOrgId
    const datasource = await Datasource.findOne( { where } )
    if ( datasource ) {
      const can = rbacService.canWrite( { ownerId: datasource.ownerId, visibility: datasource.visibility ?? 'org' }, effRole ?? null, effUserId )
      if ( !can ) throw new ForbiddenError( 'Forbidden', 'DATASOURCE_FORBIDDEN' )
      try {
        return await datasource.update( data )
      } catch ( e ) {
        throw new AppError( 'Failed to update datasource', 500, 'DATASOURCE_UPDATE_FAILED', e )
      }
    }
    return null
  },

  delete: async ( id: number, ctx?: ServiceContext ) => {
    const effOrgId = ctx?.orgId
    const effUserId = ctx?.user?.id
    const effRole = ctx?.role
    const where: WhereOptions = { id }
    if ( effOrgId ) where.orgId = effOrgId
    const datasource = await Datasource.findOne( { where } )
    if ( datasource ) {
      const can = rbacService.canDelete( { ownerId: datasource.ownerId, visibility: datasource.visibility ?? 'org' }, effRole ?? null, effUserId )
      if ( !can ) throw new ForbiddenError( 'Forbidden', 'DATASOURCE_FORBIDDEN' )
      // 依赖校验：是否有数据集引用该数据源
      const deps = await Dataset.count( { where: { sourceId: id, ...( effOrgId ? { orgId: effOrgId } : {} ) } } )
      if ( deps > 0 ) {
        throw new ConflictError( '该数据源存在关联的数据集，无法删除', 'DATASOURCE_IN_USE' )
      }
      try {
        await datasource.destroy()
        return true
      } catch ( e ) {
        throw new AppError( 'Failed to delete datasource', 500, 'DATASOURCE_DELETE_FAILED', e )
      }
    }
    return false
  },

  // 枚举数据源元数据：schemas
  listSchemas: async ( id: number, ctx?: ServiceContext ): Promise<string[]> => {
    const effOrgId = ctx?.orgId
    const effUserId = ctx?.user?.id
    const effRole = ctx?.role
    const where: WhereOptions = { id }
    if ( effOrgId ) where.orgId = effOrgId
    const ds = await Datasource.findOne( { where } )
    if ( !ds ) throw new NotFoundError( 'Datasource not found', 'DATASOURCE_NOT_FOUND' )
    const allowed = rbacService.canRead( { ownerId: ds.ownerId, visibility: ds.visibility ?? 'org' }, effRole ?? null, effUserId )
    if ( !allowed ) throw new ForbiddenError( 'Forbidden', 'DATASOURCE_FORBIDDEN' )

    // 归一化引擎类型并兼容多种 config key
    const rawType = String( ds.type ).toLowerCase()
    const normalize = ( t: string ): QueryEngineType => {
      const map: Record<string, QueryEngineType> = {
        mysql: 'mysql',
        postgresql: 'postgresql',
        postgres: 'postgresql',
        clickhouse: 'clickhouse',
        oracle: 'oracle',
        mssql: 'mssql',
        sqlserver: 'mssql',
        mongodb: 'mongodb',
        essearch: 'essearch',
        elasticsearch: 'essearch',
        es: 'essearch'
      }
      const n = map[t]
      if ( !n ) throw new AppError( '不支持的数据源类型: ' + t, 400, 'DATASOURCE_UNSUPPORTED' )
      return n
    }
    const engineType = normalize( rawType )
    const cfg = ( ds.config as Record<string, unknown> )
    const configKeyCandidates: Record<QueryEngineType, string[]> = {
      mysql: ['mysql'],
      postgresql: ['postgresql', 'postgres'],
      clickhouse: ['clickhouse'],
      oracle: ['oracle'],
      mssql: ['mssql', 'sqlserver'],
      mongodb: ['mongodb'],
      essearch: ['essearch', 'elasticsearch', 'es']
    }
    const keys = configKeyCandidates[engineType]
    const foundKey = keys.find( k => cfg && Object.prototype.hasOwnProperty.call( cfg, k ) )
    if ( !foundKey ) throw new NotFoundError( '找不到对应的连接配置，请检查数据源配置: ' + JSON.stringify( Object.keys( cfg || {} ) ), 'DATASOURCE_CONFIG_NOT_FOUND' )
    const engineConfig = cfg[foundKey] as unknown as import( '@lumina/query-engine' ).QueryEngineConnectorConfig
    const qe = QueryEngine( engineType, engineConfig )
    return await qe.connector.listSchemas()
  },

  // 枚举数据源元数据：tables（可选 schema）
  listTables: async ( id: number, schema: string | undefined, ctx?: ServiceContext ): Promise<Array<{ schema?: string, name: string }>> => {
    const effOrgId = ctx?.orgId
    const effUserId = ctx?.user?.id
    const effRole = ctx?.role
    const where: WhereOptions = { id }
    if ( effOrgId ) where.orgId = effOrgId
    const ds = await Datasource.findOne( { where } )
    if ( !ds ) throw new NotFoundError( 'Datasource not found', 'DATASOURCE_NOT_FOUND' )
    const allowed = rbacService.canRead( { ownerId: ds.ownerId, visibility: ds.visibility ?? 'org' }, effRole ?? null, effUserId )
    if ( !allowed ) throw new ForbiddenError( 'Forbidden', 'DATASOURCE_FORBIDDEN' )

    const rawType = String( ds.type ).toLowerCase()
    const map: Record<string, QueryEngineType> = {
      mysql: 'mysql',
      postgresql: 'postgresql',
      postgres: 'postgresql',
      clickhouse: 'clickhouse',
      oracle: 'oracle',
      mssql: 'mssql',
      sqlserver: 'mssql',
      mongodb: 'mongodb',
      essearch: 'essearch',
      elasticsearch: 'essearch',
      es: 'essearch'
    }
    const engineType = map[rawType]
    if ( !engineType ) throw new AppError( '不支持的数据源类型: ' + rawType, 400, 'DATASOURCE_UNSUPPORTED' )
    const cfg = ( ds.config as Record<string, unknown> )
    const configKeyCandidates: Record<QueryEngineType, string[]> = {
      mysql: ['mysql'],
      postgresql: ['postgresql', 'postgres'],
      clickhouse: ['clickhouse'],
      oracle: ['oracle'],
      mssql: ['mssql', 'sqlserver'],
      mongodb: ['mongodb'],
      essearch: ['essearch', 'elasticsearch', 'es']
    }
    const keys = configKeyCandidates[engineType]
    const foundKey = keys.find( k => cfg && Object.prototype.hasOwnProperty.call( cfg, k ) )
    if ( !foundKey ) throw new NotFoundError( '找不到对应的连接配置，请检查数据源配置: ' + JSON.stringify( Object.keys( cfg || {} ) ), 'DATASOURCE_CONFIG_NOT_FOUND' )
    const engineConfig = cfg[foundKey] as unknown as import( '@lumina/query-engine' ).QueryEngineConnectorConfig
    const qe = QueryEngine( engineType, engineConfig )
    return await qe.connector.listTables( schema )
  },

  // 枚举数据源元数据：columns（需 table，schema 可选）
  listColumns: async ( id: number, schema: string | undefined, table: string, ctx?: ServiceContext ): Promise<Array<{ name: string, type: string }>> => {
    const effOrgId = ctx?.orgId
    const effUserId = ctx?.user?.id
    const effRole = ctx?.role
    const where: WhereOptions = { id }
    if ( effOrgId ) where.orgId = effOrgId
    const ds = await Datasource.findOne( { where } )
    if ( !ds ) throw new NotFoundError( 'Datasource not found', 'DATASOURCE_NOT_FOUND' )
    const allowed = rbacService.canRead( { ownerId: ds.ownerId, visibility: ds.visibility ?? 'org' }, effRole ?? null, effUserId )
    if ( !allowed ) throw new ForbiddenError( 'Forbidden', 'DATASOURCE_FORBIDDEN' )

    const rawType = String( ds.type ).toLowerCase()
    const map: Record<string, QueryEngineType> = {
      mysql: 'mysql',
      postgresql: 'postgresql',
      postgres: 'postgresql',
      clickhouse: 'clickhouse',
      oracle: 'oracle',
      mssql: 'mssql',
      sqlserver: 'mssql',
      mongodb: 'mongodb',
      essearch: 'essearch',
      elasticsearch: 'essearch',
      es: 'essearch'
    }
    const engineType = map[rawType]
    if ( !engineType ) throw new AppError( '不支持的数据源类型: ' + rawType, 400, 'DATASOURCE_UNSUPPORTED' )
    const cfg = ( ds.config as Record<string, unknown> )
    const configKeyCandidates: Record<QueryEngineType, string[]> = {
      mysql: ['mysql'],
      postgresql: ['postgresql', 'postgres'],
      clickhouse: ['clickhouse'],
      oracle: ['oracle'],
      mssql: ['mssql', 'sqlserver'],
      mongodb: ['mongodb'],
      essearch: ['essearch', 'elasticsearch', 'es']
    }
    const keys = configKeyCandidates[engineType]
    const foundKey = keys.find( k => cfg && Object.prototype.hasOwnProperty.call( cfg, k ) )
    if ( !foundKey ) throw new NotFoundError( '找不到对应的连接配置，请检查数据源配置: ' + JSON.stringify( Object.keys( cfg || {} ) ), 'DATASOURCE_CONFIG_NOT_FOUND' )
    const engineConfig = cfg[foundKey] as unknown as import( '@lumina/query-engine' ).QueryEngineConnectorConfig
    const qe = QueryEngine( engineType, engineConfig )
    return await qe.connector.listColumns( schema, table )
  }
}
