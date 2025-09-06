import type { DatasetField } from '@lumina/types'

type Primitive = string | number | boolean | null

// 字段使用配置
export interface FieldUsage {
  field: DatasetField
  aggregationType: 'sum' | 'count' | 'avg' | 'max' | 'min' | 'count_distinct'
  alias?: string
}

// 筛选器配置
export interface FilterConfig {
  field: DatasetField
  operator:
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'in'
  | 'not_in'
  | 'is_null'
  | 'is_not_null'
  | 'between'
  | 'like'
  | 'gt'
  | 'lt'
  values: Primitive[]
}

// 图表类型配置
export interface ChartType {
  key: string
  name: string
  icon: React.ReactNode
  minDimensions: number
  minMetrics: number
}

// 聚合函数配置
export interface AggregationType {
  key: string
  name: string
  applicable: string[]
}

// 数据集类型
// export interface Dataset {
//   id: number;
//   name: string;
//   baseTable: string;
// }

// 设置项类型
export type SettingItem =
  | {
      key: string
      label: string
      type: 'input'
      defaultValue: string
      placeholder?: string
    }
  | {
      key: string
      label: string
      type: 'switch'
      defaultValue: boolean
    }
  | {
      key: string
      label: string
      type: 'select'
      defaultValue: string
      options: Array<{ value: string; label: string }>
    }
  | {
      key: string
      label: string
      type: 'number'
      defaultValue: number
      min?: number
      max?: number
    }

// 筛选器操作符
export interface FilterOperator {
  key: string
  name: string
}

// 图表配置类型
export interface ChartConfig {
  chartType: string
  title?: string
  dimensions: FieldUsage[]
  metrics: FieldUsage[]
  filters: FilterConfig[]
  // 新增：排序描述，字段名与 query-engine 保持一致：orderBy
  orderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>
  settings: {
    limit?: number
    showDataLabels?: boolean
    showLegend?: boolean
    showGridLines?: boolean
    colorScheme?: string
  [key: string]: string | number | boolean | undefined
  }
}
