// 避免循环依赖，直接声明核心字段
export interface DatasetField {
  identifier: string
  name: string
  expression: string
  type: string
  isDimension?: boolean
  isMetric?: boolean
  description?: string
  indexable?: boolean
}

export interface DatasetAttributes {
  id: number
  name: string
  sourceId: string
  description?: string
  baseTable: string
  baseSchema?: string
  queryTemplate?: string
  fields: DatasetField[]
  parameters?: Array<{ name: string, type: string, defaultValue?: unknown }>
  createdAt?: Date
  updatedAt?: Date
  createdBy: string
  updatedBy: string
}

export interface DatasourceAttributes {
  id: number
  name: string
  type: string
  config: object
  createdAt?: Date
  updatedAt?: Date
}

export type QueryDataset = DatasetAttributes | Record<string, unknown>
export type QueryDatasource = DatasourceAttributes | Record<string, unknown>

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
  filters: Array<{
    field: { identifier: string, name: string, type: string }
    operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'is_null' | 'is_not_null'
  values: unknown[]
  }>
  limit?: number
  offset?: number
  orderBy?: Array<{
    field: string
    direction: 'asc' | 'desc'
  }>
}

export interface QueryResult<T = Record<string, unknown>> {
  data: T[]
  totalCount: number
  executionTime: number
  sql?: string
}
