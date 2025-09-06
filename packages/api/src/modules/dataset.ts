// packages/api/src/modules/dataset.ts
import { get, post, put, del } from '../index'
import type {
  Dataset,
  DatasetField,
  FieldType,
  QueryParameter,
  PaginatedResponse
} from '@lumina/types'
import type { ApiResponse } from '../types'
// ...existing code...
// 图表构建器专用接口
export interface ChartQueryRequest {
  dimensions: Array<{
    field: {
      identifier: string
      name: string
      type: string
    }
    alias?: string
  }>
  metrics: Array<{
    field: {
      identifier: string
      name: string
      type: string
    }
    aggregationType: 'sum' | 'count' | 'avg' | 'max' | 'min' | 'count_distinct'
    alias?: string
  }>
  filters: Array<{
    field: {
      identifier: string
      name: string
      type: string
    }
    operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'between' | 'in' | 'not_in' | 'is_null' | 'is_not_null'
  values: unknown[]
  }>
  limit?: number
  offset?: number
  orderBy?: Array<{
    field: string
    direction: 'asc' | 'desc'
  }>
}
export interface ChartQueryResult {
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

export interface DistinctValuesResponse {
  values: Array<{ value: unknown, label: string }>
}

// 原有接口保持兼容
export interface CreateDatasetRequest {
  name: string
  sourceId: number
  description?: string
  fields: DatasetField[]
  parameters?: QueryParameter[]
  baseTable: string
  baseSchema?: string
  queryTemplate?: string
  joins?: Array<{ table: string, schema?: string, alias?: string, type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL', on: Array<{ left: string, right: string }> }>
}

export interface UpdateDatasetRequest {
  name?: string
  sourceId?: number
  description?: string
  fields?: DatasetField[]
  parameters?: QueryParameter[]
  baseTable?: string
  baseSchema?: string
  queryTemplate?: string
  joins?: Array<{ table: string, schema?: string, alias?: string, type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL', on: Array<{ left: string, right: string }> }>
  // 权限修改
  visibility?: 'private' | 'org' | 'public'
  ownerId?: number
}

export interface DatasetQueryParams {
  name?: string
  sourceId?: number
  search?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  createdAfter?: string
  createdBefore?: string
}

// 传统查询接口（保持兼容）
export interface ExecuteQueryRequest {
  parameters?: Record<string, unknown>
  fields?: string[]
  filters?: QueryFilter[]
  limit?: number
  offset?: number
}

export interface QueryFilter {
  field: string
  operator: string
  value: unknown
}

export interface QueryResult {
  columns: string[]
  rows: Array<Record<string, unknown>>
  query?: string
  stats: {
    executionTime: number
    rowCount: number
    totalRows?: number
    scannedBytes?: number
  }
}
// 数据集API
export const datasetApi = {
  // 基础 CRUD 操作
  list: async ( params?: DatasetQueryParams ) => {
    return await get<PaginatedResponse<Dataset>>( '/api/datasets', { params } )
  },

  get: async ( id: number, includeSource: boolean = false ): Promise<Dataset> => {
    const queryString = includeSource ? 'includeSource=true' : ''
    const url = queryString ? `/api/datasets/${id}?${queryString}` : `/api/datasets/${id}`
    return await get<Dataset>( url )
  },

  create: async ( data: CreateDatasetRequest ): Promise<Dataset> => {
    return await post<Dataset>( '/api/datasets', data )
  },

  update: async ( id: number, data: UpdateDatasetRequest ): Promise<Dataset> => {
    return await put<Dataset>( `/api/datasets/${id}`, data )
  },

  delete: async ( id: number ): Promise<void> => {
    await del( `/api/datasets/${id}` )
  },

  // 配置和字段相关
  getConfig: async ( id: number ): Promise<{
    fields: DatasetField[]
    parameters: QueryParameter[]
  }> => {
    return await get<{
      fields: DatasetField[]
      parameters: QueryParameter[]
    }>( `/api/datasets/${id}/config` )
  },

  getFields: async ( id: number ): Promise<DatasetField[]> => {
    return await get<DatasetField[]>( `/api/datasets/${id}/fields` )
  },

  validateExpression: async ( expression: string, sourceId: number ): Promise<{
    valid: boolean
    message: string
  }> => {
    return await post<{
      valid: boolean
      message: string
    }>( '/api/datasets/validate-expression', { expression, sourceId } )
  },

  // 图表构建器专用查询接口
  executeChartQuery: async ( id: number, request: ChartQueryRequest ): Promise<ChartQueryResult> => {
    return await post<ChartQueryResult>( `/api/datasets/${id}/execute-query`, request )
  },

  previewChartQuery: async ( id: number, request: ChartQueryRequest ): Promise<{
    sql: string
    estimatedRows?: number
  }> => {
    return await post<{
      sql: string
      estimatedRows?: number
    }>( `/api/datasets/${id}/preview-query`, request )
  },

  // 字段去重取值（用于级联筛选）
  getDistinctValues: async (
    id: number,
    payload: { field: { identifier: string, name?: string, type?: string }, filters?: ChartQueryRequest['filters'], limit?: number, search?: string }
  ): Promise<DistinctValuesResponse> => {
    return await post<DistinctValuesResponse>( `/api/datasets/${id}/distinct-values`, payload )
  },

  // 传统查询接口（保持兼容）
  executeQuery: async ( id: number, request: ExecuteQueryRequest ): Promise<QueryResult> => {
    return await post<QueryResult>( `/api/datasets/${id}/query`, request )
  }
}

// 图表构建器专用的工具函数
export const chartBuilderUtils = {
  // 将字段转换为维度配置
  fieldToDimension: ( field: DatasetField ): ChartQueryRequest['dimensions'][0] => ( {
    field: {
      identifier: field.identifier,
      name: field.name,
      type: field.type
    }
  } ),

  // 将字段转换为指标配置
  fieldToMetric: ( field: DatasetField, aggregationType: ChartQueryRequest['metrics'][0]['aggregationType'] = 'sum' ): ChartQueryRequest['metrics'][0] => ( {
    field: {
      identifier: field.identifier,
      name: field.name,
      type: field.type
    },
    aggregationType
  } ),

  // 构建筛选器
  buildFilter: ( field: DatasetField, operator: ChartQueryRequest['filters'][0]['operator'], values: unknown[] ): ChartQueryRequest['filters'][0] => ( {
    field: {
      identifier: field.identifier,
      name: field.name,
      type: field.type
    },
    operator,
    values
  } ),

  // 获取字段的默认聚合类型
  getDefaultAggregation: ( field: DatasetField ): ChartQueryRequest['metrics'][0]['aggregationType'] => {
    if ( field.isMetric ) {
      switch ( field.type ) {
      case 'INTEGER':
      case 'FLOAT':
        return 'sum'
      case 'STRING':
        return 'count'
      default:
        return 'count'
      }
    }
    return 'count'
  },

  // 验证查询配置
  validateChartQuery: ( request: ChartQueryRequest ): { valid: boolean, message?: string } => {
    if ( request.dimensions.length === 0 && request.metrics.length === 0 ) {
      return { valid: false, message: '至少需要一个维度或指标' }
    }

    // 验证字段标识符
    const allFields = [...request.dimensions, ...request.metrics, ...request.filters]
    for ( const item of allFields ) {
      if ( !item.field.identifier || !item.field.name ) {
        return { valid: false, message: '字段配置不完整' }
      }
    }

    // 验证聚合类型
    const validAggregations = ['sum', 'count', 'avg', 'max', 'min', 'count_distinct']
    for ( const metric of request.metrics ) {
      if ( !validAggregations.includes( metric.aggregationType ) ) {
        return { valid: false, message: `无效的聚合类型: ${metric.aggregationType}` }
      }
    }

    // 验证筛选器操作符
    const validOperators = ['equals', 'not_equals', 'like', 'contains', 'not_contains', 'greater_than', 'less_than', 'between', 'in', 'not_in', 'is_null', 'is_not_null']
    for ( const filter of request.filters ) {
      if ( !validOperators.includes( filter.operator ) ) {
        return { valid: false, message: `无效的筛选器操作符: ${filter.operator}` }
      }
    }

    return { valid: true }
  }
}
