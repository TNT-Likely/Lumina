export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

export interface RequestOptions<D = unknown> extends Omit<ApiRequestConfig<D>, 'baseURL' | 'headers' | 'timeout' | 'withCredentials'> {
  method?: HttpMethod
  data?: D
  params?: Record<string, unknown>
  customError?: boolean
  customErrorHandler?: ErrorHandler
}

export type ErrorHandler = ( error: Error, context?: { url: string, options?: RequestOptions } ) => void | Promise<void>
export interface ApiRequestConfig<D = unknown> {
  baseURL?: string
  headers?: Record<string, string>
  timeout?: number
  withCredentials?: boolean
  customErrorHandler?: ErrorHandler
  // 允许扩展axios配置
  [key: string]: unknown
}

export interface ApiClientConfig extends ApiRequestConfig {
  defaultErrorHandler?: ErrorHandler
}
export interface PaginatedResponse<T> {
  list: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface ApiResponse<T = unknown> {
  success: boolean
  code: number | string
  data: T
  message: string
}
