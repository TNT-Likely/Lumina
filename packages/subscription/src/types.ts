import type { Subscription } from '@lumina/types'

export interface SubscriptionMessage {
  subscriptionId: number;
  dashboardId: number;
  config: Subscription['config'];
  schedule: string;
  name: string;
  sendAt: string;
  nextSendAt?: string;
  /** 幂等唯一key: 订阅id+sendAt */
  messageId: string;
}

export interface ConsumeResult {
  notifyResults: Array<{ notifyId: string; success: boolean; message?: string }>
  success: boolean
  nextScheduleResult: { success: boolean; error?: unknown }
}

export interface InspectResult {
  subscriptionId: number;
  missed: boolean;
  reason?: string;
  action: 'none' | 'resend';
}

export type SubscriptionStatus = 'active' | 'paused';
