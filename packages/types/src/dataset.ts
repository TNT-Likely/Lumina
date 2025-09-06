// dataset 相关类型

export type FieldType = 'STRING' | 'INTEGER' | 'FLOAT' | 'DATE' | 'BOOLEAN' | 'TIMESTAMP';

export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL'

export interface DatasetJoinCondition {
  left: string // 如 orders.user_id 或 别名.user_id
  right: string // 如 users.id 或 别名.id
}

export interface DatasetJoin {
  table: string
  schema?: string
  alias?: string
  type: JoinType
  on: DatasetJoinCondition[]
}

export interface DatasetField {
  identifier: string;
  name: string;
  type: FieldType;
  expression: string;
  isDimension: boolean;
  isMetric: boolean;
  description?: string;
  // 可选：字段取值的枚举映射，用于将原始值映射为展示文案（例如 user_level: 1 -> "黄金会员"）
  // 选择使用数组以保留顺序，并允许多类型取值（string/number/boolean/null）
  valueMap?: Array<{ value: string | number | boolean | null; label: string }>;
}

export interface QueryParameter {
  name: string;
  type: FieldType;
  defaultValue?: string | number | boolean | null;
  description?: string;
}

export interface Dataset {
  id: number;
  name: string;
  sourceId: number
  fields: DatasetField[];
  parameters?: QueryParameter[];
  description?: string;
  // 基础表+查询模板（用于可视化联表）
  baseTable?: string
  baseSchema?: string
  queryTemplate?: string
  joins?: DatasetJoin[]
  // 权限相关（与后端模型对齐，可选）
  ownerId?: number;
  visibility?: 'private' | 'org' | 'public';
  canWrite?: boolean;
  canDelete?: boolean;
}

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
  total?: number;
}

export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}
