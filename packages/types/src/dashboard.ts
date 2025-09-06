// dashboard 相关类型

import type { BaseComponent, DashboardSettings } from './dashboardComponent'

// 全局筛选器绑定：将一个全局输入值映射到某个组件的字段
export interface GlobalFilterBinding {
  componentId: string
  field: { identifier: string; name?: string }
  // 可选：为该绑定覆写操作符
  operator?: 'equals' | 'in'
}

// 全局筛选器定义（仪表板级）- 仅保留新模式（绑定）
export interface GlobalFilterDefinition {
  id: string
  label: string
  // 输入值类型，决定前端控件：string/number/date/datetime/boolean/geo
  valueType?: 'string' | 'number' | 'date' | 'datetime' | 'boolean' | 'geo'
  // 类型：单选或多选，决定值形态与默认操作符
  mode: 'single' | 'multi'
  // 操作符：默认 single=equals，multi=in
  operator?: 'equals' | 'in'
  // 输入值 → 绑定到各个组件字段（新模型）
  bindings?: GlobalFilterBinding[]
}

export interface DashboardConfig {
  components: BaseComponent[];
  settings: DashboardSettings;
  filters?: Record<string, unknown>[];
  // 仪表板级全局筛选器定义
  globalFilters?: GlobalFilterDefinition[];
  version?: string;
}

export interface Dashboard {
  id: number;
  name: string;
  config: DashboardConfig;
  description?: string;
  createdAt: string;
  updatedAt: string;
  // 权限相关（可选）
  ownerId?: number;
  visibility?: 'private' | 'org' | 'public';
  // 后端可选回传的操作权限标记（用于前端快捷判断显示编辑/删除等入口）
  canWrite?: boolean;
  canDelete?: boolean;
  // 预览辅助：当内部接口检测到存在视图无权限时，提示前端需要生成 token 以预览
  needViewToken?: boolean;
}
