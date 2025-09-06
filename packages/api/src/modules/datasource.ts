// /Users/matrix/code/mine/Lumina/packages/api/src/modules/datasource.ts

import { get, post, put, del } from '../index'
import type { Datasource, PaginatedResponse } from '@lumina/types'
import type { ApiResponse } from '../types'

// 数据源相关类型定义
// 数据源相关类型定义
// The Datasource type is now imported from @lumina/types
export interface CreateDatasourceRequest {
  name: string
  type: string
  config?: unknown
}

export interface UpdateDatasourceRequest {
  name?: string
  config?: unknown
  // 权限修改
  visibility?: 'private' | 'org' | 'public'
  ownerId?: number
}

// 数据源查询参数接口
export interface DatasourceQueryParams {
  name?: string // 按名称模糊搜索
  type?: string // 按类型筛选
  page?: number // 页码
  pageSize?: number // 每页大小
  sortBy?: string // 排序字段
  sortOrder?: 'asc' | 'desc' // 排序方向
  createdAfter?: string // 创建时间筛选
  createdBefore?: string // 创建时间筛选
}

// 数据源相关API调用
export const datasourceApi = {
  // 获取数据源列表 - 支持查询参数
  list: async ( params?: DatasourceQueryParams ): Promise<PaginatedResponse<Datasource>> => {
    return await get<PaginatedResponse<Datasource>>( '/api/datasources', { params } )
  },

  // 获取单个数据源
  get: async ( id: number ): Promise<Datasource> => {
    return await get<Datasource>( `/api/datasources/${id}` )
  },

  // 创建数据源
  create: async ( data: CreateDatasourceRequest ): Promise<Datasource> => {
    return await post<Datasource>( '/api/datasources', data )
  },

  // 更新数据源
  update: async ( id: number, data: UpdateDatasourceRequest ): Promise<Datasource> => {
    return await put<Datasource>( `/api/datasources/${id}`, data )
  },

  // 删除数据源
  delete: async ( id: number ): Promise<void> => {
    await del( `/api/datasources/${id}` )
  },

  // 获取数据源配置
  getConfig: async ( id: number ): Promise<ApiResponse<unknown>> => {
    return await get<ApiResponse<unknown>>( `/api/datasources/${id}/config` )
  },

  // 元数据枚举
  listSchemas: async ( id: number ): Promise<string[]> => {
    return await get<string[]>( `/api/datasources/${id}/schemas` )
  },
  listTables: async ( id: number, schema?: string ): Promise<Array<{ schema?: string, name: string }>> => {
    const params = schema ? { schema } : undefined
    return await get<Array<{ schema?: string, name: string }>>( `/api/datasources/${id}/tables`, { params } )
  },
  listColumns: async ( id: number, table: string, schema?: string ): Promise<Array<{ name: string, type: string }>> => {
    const params = { table, ...( schema ? { schema } : {} ) }
    return await get<Array<{ name: string, type: string }>>( `/api/datasources/${id}/columns`, { params } )
  }
}
