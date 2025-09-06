import { get, post, put, del } from '../index'
import type { Subscription, SubscriptionConfig } from '@lumina/types'
export interface CreateSubscriptionRequest {
  name: string
  dashboardId: string
  notifyIds: string[]
  config?: unknown
}

export interface UpdateSubscriptionRequest {
  name?: string
  notifyIds?: string[]
  config?: unknown
  // 权限修改
  visibility?: 'private' | 'org' | 'public'
  ownerId?: number
}

// 订阅相关API调用
export const subscriptionApi = {
  // 获取订阅列表（分页、条件查询）
  list: async ( params: Record<string, unknown> = {} ): Promise<{ list: Subscription[], total: number }> => {
    return await get( '/api/subscriptions', { params } )
  },

  // 获取单个订阅
  get: async ( id: string ): Promise<Subscription> => {
    return await get<Subscription>( `/api/subscriptions/${id}` )
  },

  // 创建订阅
  create: async ( data: CreateSubscriptionRequest ): Promise<Subscription> => {
    return await post<Subscription>( '/api/subscriptions', data )
  },

  // 更新订阅
  update: async ( id: number, data: UpdateSubscriptionRequest ): Promise<Subscription> => {
    return await put<Subscription>( `/api/subscriptions/${id}`, data )
  },

  // 删除订阅
  delete: async ( id: number ): Promise<void> => {
    await del( `/api/subscriptions/${id}` )
  },

  // 连通性测试
  testConnection: async ( id: number ): Promise<unknown> => {
    return await post( `/api/subscriptions/${id}/test-connection` )
  },

  // ...existing code...
  toggleEnabled: async ( id: number, enabled: boolean ): Promise<void> => {
    await post( `/api/subscriptions/${id}/toggle-enabled`, { enabled } )
  }
}
