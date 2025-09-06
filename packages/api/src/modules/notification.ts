import { get, post, put, del } from '../index'
import type { Notification, NotificationConfig, PaginatedResponse } from '@lumina/types'

// 通知相关类型定义
// 使用 @lumina/types 中的 Notification 和 NotificationConfig
export interface CreateNotificationRequest {
  name: string
  type: string
  config?: NotificationConfig
}

export interface UpdateNotificationRequest {
  name?: string
  type?: string
  config?: NotificationConfig
  // 权限修改
  visibility?: 'private' | 'org' | 'public'
  ownerId?: number
}

// 分页响应接口

// 通知相关API调用
export const notificationApi = {
  // 获取通知列表（支持参数化查询）
  list: async ( params?: Record<string, unknown> ): Promise<PaginatedResponse<Notification>> => {
    return await get( '/api/notifications', { params } )
  },

  // 获取单个通知
  get: async ( id: number ) => {
    return await get<Notification>( `/api/notifications/${id}` )
  },

  // 创建通知
  create: async ( data: CreateNotificationRequest ) => {
    return await post<Notification>( '/api/notifications', data )
  },

  // 更新通知
  update: async ( id: number, data: UpdateNotificationRequest ) => {
    return await put<Notification>( `/api/notifications/${id}`, data )
  },

  // 删除通知
  delete: async ( id: number ) => {
    await del( `/api/notifications/${id}` )
  },

  // 测试通知连通性
  testConnection: async ( id: number, type?: 'text' | 'image' ) => {
    return await post<{ success: boolean, message?: string }>( `/api/notifications/${id}/test`, { type } )
  }
}
