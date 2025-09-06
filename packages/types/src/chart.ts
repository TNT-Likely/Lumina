export interface ChartFieldRef {
  identifier: string;
}

export interface FieldUsage {
  field: ChartFieldRef;
  aggregationType: 'sum' | 'count' | 'avg' | 'max' | 'min' | 'count_distinct';
  alias?: string;
}

// 筛选器配置
export interface FilterConfig {
  field: ChartFieldRef;
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
    | 'lt';
  values: Array<string | number | boolean | null>;
}

// 聚合函数配置
export interface AggregationType {
  key: string;
  name: string;
  applicable: string[];
}

// 图表配置类型
export interface ChartConfig {
  chartType: string;
  title?: string;
  dimensions: FieldUsage[];
  metrics: FieldUsage[];
  filters: FilterConfig[];
  // 排序：与 query-engine 一致的 orderBy 字段
  orderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  settings: {
    limit?: number;
    showDataLabels?: boolean;
    showLegend?: boolean;
    showGridLines?: boolean;
    colorScheme?: string;
  [key: string]: string | number | boolean | undefined;
  };
}
