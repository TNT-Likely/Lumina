// view 相关类型

// chartBuilder 视图专用配置类型
export interface ViewConfig {
  chartConfig: import('./chart').ChartConfig;
  /**
   * @deprecated 请使用 View 顶层的 datasetId；此字段仅为兼容旧数据，前端不再写入。
   */
  datasetId?: string | number;
  queryResult: null
}

export interface View {
  id: number;
  type: string;
  name: string;
  datasetId: string;
  config: ViewConfig;
  description?: string;
  // 权限相关（可选）
  ownerId?: number;
  visibility?: 'private' | 'org' | 'public';
  // 操作权限（后端可选回传）
  canWrite?: boolean;
  canDelete?: boolean;
}
