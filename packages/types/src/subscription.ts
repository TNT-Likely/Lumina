// subscription 相关类型

export interface SubscriptionConfig {
  /** cron 表达式或人性化时间描述 */
  schedule: string;
  /** 订阅内容格式 */
  format: 'table' | 'image' | 'pdf' | 'excel';
  /** 过滤条件 */
  filter?: string;
  /** 备注说明 */
  remark?: string;

}

export interface Subscription {
  id: number;
  name: string;
  dashboardId: number;
  config: SubscriptionConfig;
  createdAt: string;
  updatedAt: string;
  /** 是否启用 */
  enabled?: boolean;
  notifyIds: number[];
  // 权限相关（与后端模型对齐，可选）
  ownerId?: number;
  visibility?: 'private' | 'org' | 'public';
  canWrite?: boolean;
  canDelete?: boolean;
}
