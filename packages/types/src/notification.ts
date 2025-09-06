// notification 相关类型

export type NotificationType =
  | 'ding'
  | 'email'
  | 'telegram'
  | 'slack'
  | 'lark'
  | 'discord'

export interface DingConfig {
  accessToken: string;
  secret?: string;
}
export interface EmailConfig {
  host: string;
  port: string | number;
  user: string;
  pass: string;
  to: string;
}
export interface TelegramConfig {
  botToken: string;
  chatId: string;
}
export interface SlackConfig {
  webhookUrl: string;
}
export interface LarkConfig {
  webhook: string;
}
export interface DiscordConfig {
  webhook: string;
}
export type NotificationConfig = {
  ding?: DingConfig;
  email?: EmailConfig;
  telegram?: TelegramConfig;
  slack?: SlackConfig;
  lark?: LarkConfig;
  discord?: DiscordConfig;
  [key: string]: unknown;
};

export interface Notification {
  id: number;
  name: string;
  type: string;
  config?: NotificationConfig;
  createdAt: string;
  updatedAt: string;
  // 权限相关（与后端模型对齐，可选）
  ownerId?: number;
  visibility?: 'private' | 'org' | 'public';
  canWrite?: boolean; // 新增字段
  canDelete?: boolean; // 新增字段
}
