// /Users/matrix/code/mine/Lumina/packages/api/src/modules/dashboard.ts

import { get, post, put, del } from '../index'
import { type ApiResponse, type PaginatedResponse } from '../types'
import type { Dashboard, DashboardConfig } from '@lumina/types'

export interface CreateDashboardRequest {
  name: string
  description?: string
  config: DashboardConfig
}
export interface UpdateDashboardRequest {
  name?: string
  description?: string
  config?: DashboardConfig
  // 权限修改
  visibility?: 'private' | 'org' | 'public'
  ownerId?: number
}

export interface DashboardQueryParams {
  name?: string
  creator?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  // 可扩展更多条件
}

// 仪表板相关API调用
export const dashboardApi = {
  // 支持分页和条件查询
  list: async ( params?: DashboardQueryParams ): Promise<PaginatedResponse<Dashboard>> => {
    return await get<PaginatedResponse<Dashboard>>( '/api/dashboards', { params } )
  },
  // 获取单个仪表板
  get: async ( id: string | number ): Promise<Dashboard> => {
    return await get<Dashboard>( `/api/dashboards/${id}` )
  },

  // 创建仪表板
  create: async ( data: CreateDashboardRequest ) => {
    return await post<Dashboard>( '/api/dashboards', data )
  },

  // 更新仪表板
  update: async ( id: number, data: UpdateDashboardRequest ) => {
    return await put<Dashboard>( `/api/dashboards/${id}`, data )
  },

  // 删除仪表板
  delete: async ( id: number ) => {
    return await del<void>( `/api/dashboards/${id}` )
  },

  // 获取仪表板配置
  getConfig: async ( id: number ) => {
    return await get<Dashboard>( `/api/dashboards/${id}/config` )
  },

  // 获取仪表板过滤器
  getFilters: async ( id: number ) => {
    return await get<Dashboard['config']['filters'][]>( `/api/dashboards/${id}/filters` )
  }
}
