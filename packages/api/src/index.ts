import { ApiClient } from './core/client'
import type { ApiClientConfig, RequestOptions, ErrorHandler } from './types/index'

// 创建默认实例
let defaultClient: ApiClient | null = null

// 初始化API客户端
export const initApiClient = ( config: ApiClientConfig = {} ): ApiClient => {
  defaultClient = new ApiClient( config )
  return defaultClient
}

// 获取默认客户端实例
export const getApiClient = (): ApiClient => {
  if ( !defaultClient ) {
    defaultClient = new ApiClient()
  }
  return defaultClient
}

// 便捷请求方法
export const request = async <T = unknown>( url: string, options?: RequestOptions ): Promise<T> => {
  return await getApiClient().request<T>( url, options )
}

export const get = async <T = unknown>( url: string, options?: Omit<RequestOptions, 'method' | 'data'> ): Promise<T> => {
  return await getApiClient().get<T>( url, options )
}

export const post = async <T = unknown>( url: string, data?: unknown, options?: Omit<RequestOptions, 'method'> ): Promise<T> => {
  return await getApiClient().post<T>( url, data, options )
}

export const put = async <T = unknown>( url: string, data?: unknown, options?: Omit<RequestOptions, 'method'> ): Promise<T> => {
  return await getApiClient().put<T>( url, data, options )
}

export const del = async <T = unknown>( url: string, options?: Omit<RequestOptions, 'method' | 'data'> ): Promise<T> => {
  return await getApiClient().delete<T>( url, options )
}

export const patch = async <T = unknown>( url: string, data?: unknown, options?: Omit<RequestOptions, 'method'> ): Promise<T> => {
  return await getApiClient().patch<T>( url, data, options )
}

// 设置全局默认错误处理
export const setDefaultErrorHandler = ( handler: ErrorHandler ): void => {
  getApiClient().setDefaultErrorHandler( handler )
}

// 导出类型
export type {
  ApiClientConfig,
  ApiResponse,
  RequestOptions,
  ErrorHandler,
  HttpMethod
} from './types/index'

// 导出类
export { ApiClient }
export { ApiError } from './core/client'

// 导出各模块API
export * from './modules/index'
