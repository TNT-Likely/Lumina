// /Users/matrix/code/mine/Lumina/packages/api/src/modules/view.ts

import { get, post, put, del } from '../index'
import type { View, PaginatedResponse, ViewConfig } from '@lumina/types'
export interface CreateViewRequest {
  name: string
  description?: string
  config?: ViewConfig
  // 视图所属数据集，后端模型必填
  datasetId?: number
}

export interface UpdateViewRequest {
  name?: string
  description?: string
  config?: ViewConfig
  // 权限修改
  visibility?: 'private' | 'org' | 'public'
  ownerId?: number
  datasetId?: number
}

export interface ViewQueryParams {
  name?: string
  type?: string
  datasetId?: number
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// 视图相关API调用
export const viewApi = {
  // 基础 CRUD 操作
  list: async ( params?: ViewQueryParams ): Promise<PaginatedResponse<View>> => {
    return await get<PaginatedResponse<View>>( '/api/views', { params } )
  },

  // 获取单个视图
  get: async ( id: number ): Promise<View> => {
    return await get<View>( `/api/views/${id}` )
  },

  // 创建视图
  create: async ( data: CreateViewRequest ): Promise<View> => {
    return await post<View>( '/api/views', data )
  },

  // 更新视图
  update: async ( id: number, data: UpdateViewRequest ): Promise<View> => {
    return await put<View>( `/api/views/${id}`, data )
  },

  // 删除视图
  delete: async ( id: number ): Promise<void> => {
    await del( `/api/views/${id}` )
  },

  // 获取视图配置
  getConfig: async ( id: number ) => {
    return await get<ViewConfig>( `/api/views/${id}/config` )
  },

  // 获取视图子元素
  getChildren: async ( id: number ): Promise<unknown[]> => {
    return await get<unknown[]>( `/api/views/${id}/children` )
  },

  // 获取视图数据
  getData: async ( id: number, params: Record<string, unknown> ): Promise<unknown> => {
    return await post<unknown>( `/api/views/${id}/data`, params )
  },
  // 新增：获取视图详情（配置 + 字段）
  getDetail: async ( id: number ): Promise<{ id: number, name: string, description?: string, config: ViewConfig, datasetId?: number, fields: Array<import( '@lumina/types' ).DatasetField> }> => {
    return await get( `/api/views/${id}/detail` )
  }
}
