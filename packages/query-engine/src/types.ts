export type AggregationType = 'sum' | 'count' | 'avg' | 'max' | 'min' | 'count_distinct'

export interface QueryField {
  identifier: string
  name: string
  type: string
}

export interface QueryDimension {
  field: QueryField
  alias?: string
}

export interface QueryMetric {
  field: QueryField
  aggregationType: AggregationType
  alias?: string
}

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'between'
  | 'in'
  | 'not_in'
  | 'is_null'
  | 'is_not_null'

export type FilterValue = string | number | boolean | null | Date

export interface QueryFilter {
  field: QueryField
  operator: FilterOperator
  values: FilterValue[]
}

// 支持分组筛选（AND/OR 嵌套）
export interface QueryFilterGroup {
  op: 'AND' | 'OR'
  children: Array<QueryFilter | QueryFilterGroup>
}

export interface QueryExecutionParams {
  dimensions: QueryDimension[]
  metrics: QueryMetric[]
  // 兼容：可传平铺数组（AND 连接）或分组结构
  filters: QueryFilter[] | QueryFilterGroup
  limit?: number
  offset?: number
  orderBy?: Array<{
    field: string
    direction: 'asc' | 'desc'
  }>
}

export interface QueryDataset {
  name: string
  baseTable?: string
  baseSchema?: string
  fields: Array<{ identifier: string, expression: string }>
  joins?: Array<{
    table: string
    schema?: string
    alias?: string
    type: 'INNER' | 'LEFT' | 'RIGHT' | 'FULL'
    on: Array<{ left: string, right: string }>
  }>
}

export interface QueryResult {
  data: Array<Record<string, unknown>>
  totalCount: number
  executionTime: number
  sql?: string
}
