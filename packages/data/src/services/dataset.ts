// packages/data/src/services/dataset.ts
import { Dataset, Datasource, View } from '../models'
import { Op, type Order, type WhereOptions, type FindOptions } from 'sequelize'
import { rbacService } from './rbac'
import type { OrgRole } from '../models/organizationMember'
// Note: Define local paginated response type to include optional canCreate flag
import { QueryEngine, QueryEngineType } from '@lumina/query-engine'
import { AppError, ConflictError, ForbiddenError, NotFoundError } from '../errors'
import type { ServiceContext } from '../types/context'

export interface DatasetServiceQueryParams {
  id?: number
  name?: string
  sourceId?: number
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  createdAfter?: string
  createdBefore?: string
  search?: string
  orgId?: number
  currentUserId?: number
  role?: OrgRole | null
}

export interface QueryExecutionParams {
  dimensions: Array<{
    field: { identifier: string, name: string, type: string }
    alias?: string
  }>
  metrics: Array<{
    field: { identifier: string, name: string, type: string }
    aggregationType: 'sum' | 'count' | 'avg' | 'max' | 'min' | 'count_distinct'
    alias?: string
  }>
  // 兼容：平铺数组（AND）或分组
  filters: Array<{
    field: { identifier: string, name: string, type: string }
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in' | 'is_null' | 'is_not_null'
    values: Array<string | number | boolean | null | Date>
  }> | import( '@lumina/query-engine' ).QueryFilterGroup
  limit?: number
  offset?: number
  orderBy?: Array<{
    field: string
    direction: 'asc' | 'desc'
  }>
}

export interface QueryResult {
  data: Array<Record<string, unknown>>
  totalCount: number
  executionTime: number
  sql?: string
}

type JoinDef = { table: string, schema?: string, alias?: string, type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL', on: Array<{ left: string, right: string }> }

export interface DistinctValuesParams {
  field: { identifier: string, name?: string, type?: string }
  // 上下文筛选（不包含自身字段），用于级联时按已选条件收敛可选值
  filters?: Array<{
    field: { identifier: string, name?: string, type?: string }
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in' | 'is_null' | 'is_not_null'
    values: Array<string | number | boolean | null | Date>
  }>
  limit?: number
  search?: string // 可选的前缀/包含搜索
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

export const datasetService = {
  // ctx-only: findById(id, { includeSource?, explainAuth? }, ctx)
  findById: async (
    id: number,
    opts: { includeSource?: boolean; explainAuth?: boolean } = {},
    ctx?: ServiceContext
  ) => {
    const includeSource = Boolean( opts.includeSource )
    const explainAuth = Boolean( opts.explainAuth )
    const effOrgId = ctx?.orgId
    const effUserId = ctx?.user?.id ?? null
    const effRole = ctx?.role ?? null
    const options: FindOptions = {
      ...( includeSource
        ? {
          include: [{
            association: 'source',
            attributes: ['id', 'name', 'type', 'config']
          }]
        }
        : {} ),
      where: { id }
    }
    const ds = await Dataset.findOne( options )
    if ( !ds ) {
      if ( explainAuth ) throw new NotFoundError( 'Dataset not found', 'DATASET_NOT_FOUND' )
      return null
    }
    if ( ( ds.visibility ?? 'public' ) !== 'public' && effOrgId && ds.orgId !== effOrgId ) {
      if ( explainAuth ) throw new ForbiddenError( 'Forbidden', 'DATASET_FORBIDDEN' )
      return null
    }
    const allowed = rbacService.canRead( { ownerId: ds.ownerId, visibility: ds.visibility ?? 'org' }, effRole ?? null, effUserId )
    if ( !allowed ) {
      if ( explainAuth ) throw new ForbiddenError( 'Forbidden', 'DATASET_FORBIDDEN' )
      return null
    }
    return ds
  },
  // ctx-only: findAll(params, ctx)
  findAll: async ( params?: DatasetServiceQueryParams, ctx?: ServiceContext ): Promise<ServicePaginatedResponse<Dataset & { ownerId?: number; canWrite: boolean; canDelete: boolean }>> => {
    const {
      id,
      name,
      sourceId,
      page = 1,
      pageSize = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      createdAfter,
      createdBefore,
      search,
      orgId: orgIdFromParams,
      currentUserId: userIdFromParams,
      role: roleFromParams
    } = params ?? {}

    const orgId = ctx?.orgId ?? orgIdFromParams
    const currentUserId = ctx?.user?.id ?? userIdFromParams ?? null
    const role = ctx?.role ?? roleFromParams

    const baseFilters: WhereOptions = {
      ...( id ? { id } : {} ),
      ...( name ? { name: { [Op.like]: `%${name}%` } } : {} ),
      ...( sourceId ? { sourceId } : {} )
    }

    const visibilityWhere: WhereOptions = {
      [Op.or]: [
        { visibility: 'public' },
        {
          ...( orgId ? { orgId } : {} ),
          [Op.or]: [
            ...( role ? [{ visibility: 'org' }] as WhereOptions[] : [] ),
            ...( currentUserId ? [{ visibility: 'private', ownerId: currentUserId }] as WhereOptions[] : [] )
          ]
        }
      ]
    }

    const dateWhere: WhereOptions | undefined = ( createdAfter || createdBefore )
      ? {
        createdAt: {
          ...( createdAfter ? { [Op.gte]: new Date( createdAfter ) } : {} ),
          ...( createdBefore ? { [Op.lte]: new Date( createdBefore ) } : {} )
        }
      }
      : undefined

    const searchWhere: WhereOptions | undefined = ( search
      ? {
        [Op.or]: [
          { name: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } },
          { '$fields.name$': { [Op.like]: `%${search}%` } }
        ]
      }
      : undefined )

    const where: WhereOptions = {
      [Op.and]: [baseFilters, visibilityWhere, ...( dateWhere ? [dateWhere] : [] ), ...( searchWhere ? [searchWhere] : [] )]
    }

    const order: Order = [[sortBy, sortOrder.toUpperCase()]]
    const offset = ( page - 1 ) * pageSize

    try {
      const { count, rows } = await Dataset.findAndCountAll( {
        where,
        order,
        limit: pageSize,
        offset
      } )

      const data = rows.map( ds => {
        const raw = ( ds as unknown as { toJSON?: () => unknown } ).toJSON?.() ?? ds
        const obj = raw as unknown as Dataset & Record<string, unknown>
        const meta = { ownerId: obj.ownerId, visibility: ( obj.visibility ?? 'org' ) as 'private' | 'org' | 'public' }
        const sameOrg = !orgId || Number( obj.orgId ) === Number( orgId )
        const canWrite = sameOrg && rbacService.canWrite( meta, role ?? null, currentUserId )
        const canDelete = sameOrg && rbacService.canDelete( meta, role ?? null, currentUserId )
        return { ...( obj as unknown as Record<string, unknown> ), ownerId: obj.ownerId, canWrite, canDelete } as unknown as ( Dataset & { ownerId?: number; canWrite: boolean; canDelete: boolean } )
      } )

      return {
        data,
        pagination: {
          page,
          pageSize,
          total: count,
          totalPages: Math.ceil( count / pageSize )
        },
        canCreate: rbacService.canCreate( role ?? null, currentUserId )
      }
    } catch ( error ) {
      throw new AppError( 'Failed to fetch datasets', 500, 'DATASET_LIST_FAILED', error )
    }
  },
  // ctx-only: create(data, ctx)
  create: async ( data: Omit<Dataset, 'id'> & { orgId?: number, ownerId?: number, visibility?: 'private' | 'org' | 'public' }, ctx?: ServiceContext ) => {
    const effUserId = ctx?.user?.id ?? null
    const effRole = ctx?.role ?? null
    if ( !rbacService.canCreate( effRole ?? null, effUserId ) ) throw new ForbiddenError( 'Forbidden', 'DATASET_FORBIDDEN' )
    if ( !Array.isArray( data.fields ) || data.fields.length === 0 ) {
      throw new NotFoundError( 'At least one field must be defined', 'DATASET_FIELD_REQUIRED' )
    }

    const validatedFields = data.fields.map( field => {
      if ( !field.identifier ) {
        field.identifier = `${field.name.replace( /\s+/g, '_' ).toLowerCase()}_${Date.now()}`
      }
      return field
    } )

    const maybeJoins = ( data as unknown as { joins?: JoinDef[] } ).joins
    try {
      return await Dataset.create( {
        ...data,
        fields: validatedFields,
        joins: Array.isArray( maybeJoins ) ? maybeJoins : []
      } )
    } catch ( e ) {
      throw new AppError( 'Failed to create dataset', 500, 'DATASET_CREATE_FAILED', e )
    }
  },

  // ctx-only: update(id, data, ctx)
  update: async ( id: number, data: Partial<Dataset>, ctx?: ServiceContext ) => {
    const effOrgId = ctx?.orgId
    const effUserId = ctx?.user?.id ?? null
    const effRole = ctx?.role ?? null
    const dataset = await Dataset.findOne( { where: { id, ...( effOrgId ? { orgId: effOrgId } : {} ) } } )
    if ( !dataset ) {
      return null
    }

    const can = rbacService.canWrite( { ownerId: dataset.ownerId, visibility: dataset.visibility ?? 'org' }, effRole ?? null, effUserId )
    if ( !can ) throw new ForbiddenError( 'Forbidden', 'DATASET_FORBIDDEN' )

    if ( data.fields && ( !Array.isArray( data.fields ) || data.fields.length === 0 ) ) {
      throw new Error( 'At least one field must be defined' )
    }

    const incoming = data as unknown as { joins?: JoinDef[] }
    try {
      return await dataset.update( {
        ...data,
        ...( Object.prototype.hasOwnProperty.call( data, 'joins' ) ? { joins: incoming.joins || [] } : {} )
      } )
    } catch ( e ) {
      throw new AppError( 'Failed to update dataset', 500, 'DATASET_UPDATE_FAILED', e )
    }
  },

  // ctx-only: delete(id, ctx)
  delete: async ( id: number, ctx?: ServiceContext ) => {
    const effOrgId = ctx?.orgId
    const effUserId = ctx?.user?.id ?? null
    const effRole = ctx?.role ?? null
    const dataset = await Dataset.findOne( { where: { id, ...( effOrgId ? { orgId: effOrgId } : {} ) } } )
    if ( dataset ) {
      const can = rbacService.canDelete( { ownerId: dataset.ownerId, visibility: dataset.visibility ?? 'org' }, effRole ?? null, effUserId )
      if ( !can ) throw new ForbiddenError( 'Forbidden', 'DATASET_FORBIDDEN' )
      // 依赖校验：是否有视图/告警引用该数据集
      const viewDeps = await View.count( { where: { datasetId: id, ...( effOrgId ? { orgId: effOrgId } : {} ) } } )
      if ( viewDeps > 0 ) {
        throw new ConflictError( '该数据集存在关联的视图，无法删除', 'DATASET_IN_USE' )
      }
      try {
        await dataset.destroy()
        return true
      } catch ( e ) {
        throw new AppError( 'Failed to delete dataset', 500, 'DATASET_DELETE_FAILED', e )
      }
    }
    return false
  },

  validateFieldExpression: async ( expression: string, sourceId: number ) => {
    if ( !expression || expression.trim().length === 0 ) {
      return {
        valid: false,
        message: 'Expression cannot be empty'
      }
    }

    return {
      valid: true,
      message: 'Expression is valid'
    }
  },

  // ctx-only: getDatasetFields(datasetId, ctx)
  getDatasetFields: async ( datasetId: number, ctx?: ServiceContext ) => {
    const effOrgId = ctx?.orgId
    const effUserId = ctx?.user?.id ?? null
    const effRole = ctx?.role ?? null
    const dataset = await Dataset.findOne( { where: { id: datasetId, ...( effOrgId ? { orgId: effOrgId } : {} ) } } )
    if ( !dataset ) {
      throw new NotFoundError( 'Dataset not found', 'DATASET_NOT_FOUND' )
    }

    const allowed = rbacService.canRead( { ownerId: dataset.ownerId, visibility: dataset.visibility ?? 'org' }, effRole ?? null, effUserId )
    if ( !allowed ) throw new ForbiddenError( 'Forbidden', 'DATASET_FORBIDDEN' )

    return dataset.fields
  },

  findByName: async ( name: string ) => {
    return await Dataset.findOne( {
      where: { name }
    } )
  },

  // 执行数据集查询：executeQuery(datasetId, queryParams, ctx, { skipRbac? })
  executeQuery: async ( datasetId: number, queryParams: QueryExecutionParams, ctx?: ServiceContext, opts?: { skipRbac?: boolean } ): Promise<QueryResult> => {
    const startTime = Date.now()
    const effOrgId = ctx?.orgId
    const effUserId = ctx?.user?.id ?? null
    const effRole = ctx?.role ?? null
    const skip = Boolean( opts?.skipRbac )

    try {
      // 获取数据集及其关联的数据源
      const dataset = await Dataset.findOne( {
        where: { id: datasetId },
        include: [{
          association: 'source',
          attributes: ['id', 'name', 'type', 'config']
        }]
      } )

      if ( !dataset ) {
        throw new NotFoundError( 'Dataset not found', 'DATASET_NOT_FOUND' )
      }

      if ( !skip ) {
        const allowed = rbacService.canRead( { ownerId: dataset.ownerId, visibility: dataset.visibility ?? 'org' }, effRole ?? null, effUserId )
        if ( !allowed ) throw new ForbiddenError( 'Forbidden', 'DATASET_FORBIDDEN' )
      }

      if ( !dataset.source ) {
        throw new NotFoundError( 'Dataset source not found', 'DATASET_SOURCE_NOT_FOUND' )
      }
      // 验证查询参数中的字段是否存在于数据集中
      const datasetFieldMap = new Map( dataset.fields.map( f => [f.identifier, f] ) )

      // 验证维度字段
      for ( const dim of queryParams.dimensions ) {
        if ( !datasetFieldMap.has( dim.field.identifier ) ) {
          throw new NotFoundError( `Dimension field '${dim.field.identifier}' not found in dataset`, 'DATASET_FIELD_NOT_FOUND' )
        }
      }

      // 验证指标字段
      for ( const metric of queryParams.metrics ) {
        if ( !datasetFieldMap.has( metric.field.identifier ) ) {
          throw new NotFoundError( `Metric field '${metric.field.identifier}' not found in dataset`, 'DATASET_FIELD_NOT_FOUND' )
        }
      }

      // 验证筛选器字段（兼容分组）
      const validateFilterNode = ( node: QueryExecutionParams['filters'] | ( QueryExecutionParams['filters'] extends Array<infer _T> ? never : never ) ) => {
        // 运行期判断：数组 => 扁平；对象 => 分组
        const visit = ( n: unknown ) => {
          if ( !n ) return
          if ( Array.isArray( n ) ) {
            n.forEach( f => visit( f ) )
            return
          }
          const maybeGroup = n as { op?: string, children?: unknown[] }
          if ( maybeGroup && typeof maybeGroup === 'object' && maybeGroup.op && Array.isArray( maybeGroup.children ) ) {
            maybeGroup.children.forEach( c => visit( c ) )
            return
          }
          const f = n as { field?: { identifier?: string } }
          const id = f?.field?.identifier
          if ( !id ) return
          if ( !datasetFieldMap.has( id ) ) {
            throw new NotFoundError( `Filter field '${id}' not found in dataset`, 'DATASET_FIELD_NOT_FOUND' )
          }
        }
        visit( node as unknown )
      }
      validateFilterNode( queryParams.filters as unknown as never )

      // 使用查询引擎执行查询
      const { type, config } = dataset.source
      const engineType = String( type ).toLowerCase() as QueryEngineType
      const engineConfig = ( config as Record<string, unknown> )[engineType] as unknown as import( '@lumina/query-engine' ).QueryEngineConnectorConfig
      // 允许上层在 connector config 中放入 key 用于缓存区分（可选）
      const queryEngine = QueryEngine( engineType, engineConfig )
      const result = await queryEngine.query(
        dataset as unknown as {
          name: string,
          baseTable?: string,
          baseSchema?: string,
          fields: Array<{ identifier: string, expression: string }>,
          joins?: Array<{ table: string, schema?: string, alias?: string, type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL', on: Array<{ left: string, right: string }> }>
        },
        queryParams
      )

      return {
        ...result
      }
    } catch ( error ) {
      const executionTime = Date.now() - startTime
      throw new AppError( `Query execution failed (${executionTime}ms)`, 500, 'DATASET_QUERY_FAILED', { error, executionTime } )
    }
  },

  // 获取查询预览（生成SQL但不执行）：previewQuery(datasetId, queryParams, ctx)
  previewQuery: async ( datasetId: number, queryParams: QueryExecutionParams, ctx?: ServiceContext ): Promise<{ sql: string, estimatedRows?: number }> => {
    const effOrgId = ctx?.orgId
    const effUserId = ctx?.user?.id ?? null
    const effRole = ctx?.role ?? null
    const dataset = await Dataset.findOne( {
      where: { id: datasetId, ...( effOrgId ? { orgId: effOrgId } : {} ) },
      include: [{
        association: 'source',
        attributes: ['id', 'name', 'type', 'config']
      }]
    } )

    if ( dataset == null || !dataset.source ) {
      throw new NotFoundError( 'Dataset or source not found', 'DATASET_SOURCE_NOT_FOUND' )
    }

    const allowed = rbacService.canRead( { ownerId: dataset.ownerId, visibility: dataset.visibility ?? 'org' }, effRole ?? null, effUserId )
    if ( !allowed ) throw new ForbiddenError( 'Forbidden', 'DATASET_FORBIDDEN' )

    const { type, config } = dataset.source
    const engineType = String( type ).toLowerCase() as QueryEngineType
    const engineConfig = ( config as Record<string, unknown> )[engineType] as unknown as import( '@lumina/query-engine' ).QueryEngineConnectorConfig
    const queryEngine = QueryEngine( engineType, engineConfig )
    return queryEngine.connector.previewQuery(
      dataset as unknown as {
        name: string,
        baseTable?: string,
        baseSchema?: string,
        fields: Array<{ identifier: string, expression: string }>,
        joins?: Array<{ table: string, schema?: string, alias?: string, type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL', on: Array<{ left: string, right: string }> }>
      },
      queryParams
    )
  },
  // 获取某字段去重取值：getDistinctValues(datasetId, params, ctx)
  getDistinctValues: async ( datasetId: number, params: DistinctValuesParams, ctx?: ServiceContext ): Promise<{ values: Array<{ value: unknown, label: string }> }> => {
    const effOrgId = ctx?.orgId
    const effUserId = ctx?.user?.id ?? null
    const effRole = ctx?.role ?? null
    const dataset = await Dataset.findOne( { where: { id: datasetId, ...( effOrgId ? { orgId: effOrgId } : {} ) }, include: [{ association: 'source', attributes: ['id', 'name', 'type', 'config'] }] } )
    if ( !dataset || !dataset.source ) throw new NotFoundError( 'Dataset or source not found', 'DATASET_SOURCE_NOT_FOUND' )
    const allowed = rbacService.canRead( { ownerId: dataset.ownerId, visibility: dataset.visibility ?? 'org' }, effRole ?? null, effUserId )
    if ( !allowed ) throw new ForbiddenError( 'Forbidden', 'DATASET_FORBIDDEN' )

    const fieldId = params.field.identifier
    const fieldMap = new Map( dataset.fields.map( f => [f.identifier, f] ) )
    const target = fieldMap.get( fieldId )
    if ( !target ) throw new NotFoundError( `Field '${fieldId}' not found in dataset`, 'DATASET_FIELD_NOT_FOUND' )

    // 组装一个最小查询：按该字段分组即可得到去重值
    const dims: QueryExecutionParams['dimensions'] = [{ field: { identifier: target.identifier, name: target.name, type: target.type || 'STRING' }, alias: target.identifier }]
    const effFilters: NonNullable<DistinctValuesParams['filters']> = ( params.filters || [] ).filter( f => f.field.identifier !== fieldId )
    // 可选搜索：对目标字段增加 contains 过滤
    const withSearch = params.search && params.search.trim().length > 0
      ? [...effFilters, { field: { identifier: target.identifier, name: target.name, type: target.type || 'STRING' }, operator: 'contains', values: [params.search] }]
      : effFilters

    const { type, config } = dataset.source
    const engineType = String( type ).toLowerCase() as QueryEngineType
    const engineConfig = ( config as Record<string, unknown> )[engineType] as unknown as import( '@lumina/query-engine' ).QueryEngineConnectorConfig
    const engine = QueryEngine( engineType, engineConfig )

    const result = await engine.query(
      dataset as unknown as { name: string, baseTable?: string, baseSchema?: string, fields: Array<{ identifier: string, expression: string }>, joins?: JoinDef[] },
      {
        dimensions: dims,
        metrics: [],
        filters: withSearch as unknown as QueryExecutionParams['filters'],
        limit: Math.max( 1, Math.min( 500, params.limit ?? 100 ) )
      }
    )
    const alias = target.identifier
    const rawValues = ( result.data || [] ).map( ( row ) => ( row as Record<string, unknown> )[alias] )
    const mapArr = Array.isArray( ( target as { valueMap?: Array<{ value: unknown, label: string }> } ).valueMap )
      ? ( target as { valueMap?: Array<{ value: unknown, label: string }> } ).valueMap!
      : undefined
    const values = rawValues.map( ( v ) => {
      if ( mapArr ) {
        const hit = mapArr.find( m => ( m.value === v ) || ( String( m.value ) === String( v ) ) )
        if ( hit ) return { value: v, label: hit.label }
      }
      return { value: v, label: String( v ?? '' ) }
    } )
    return { values }
  }
}
