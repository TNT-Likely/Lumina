// /Users/matrix/code/mine/Lumina/packages/api/src/core/client.ts

import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse, type AxiosError } from 'axios'
import { type ApiResponse, type ApiClientConfig, type RequestOptions, type ErrorHandler } from '../types'

// 自定义错误类
export class ApiError extends Error {
  public code?: number | string
  public data?: unknown
  public response?: AxiosResponse
  public httpStatus?: number
  public bizCode?: number | string

  constructor ( message: string, code?: number | string, data?: unknown, response?: AxiosResponse ) {
    super( message )
    this.name = 'ApiError'
    this.code = code
    this.data = data
    this.response = response
  }
}

export class ApiClient {
  private axiosInstance: AxiosInstance
  private defaultErrorHandler: ErrorHandler

  constructor ( config: ApiClientConfig = {} ) {
    const {
      baseURL = '',
      timeout = 60000,
      withCredentials = true,
      headers = {},
      defaultErrorHandler,
      ...rest
    } = config

    this.axiosInstance = axios.create( {
      baseURL,
      timeout,
      withCredentials,
      headers,
      ...rest
    } )

    // 设置默认错误处理
    this.defaultErrorHandler = defaultErrorHandler || this.getDefaultErrorHandler()

    // 添加响应拦截器
    this.setupInterceptors()
  }

  // 设置拦截器
  private setupInterceptors (): void {
    // 响应拦截器
    this.axiosInstance.interceptors.response.use(
      ( response ) => response,
      ( error: AxiosError ) => {
        // 统一处理HTTP错误
        if ( error.response ) {
          // 服务器返回了错误状态码
          const { status, data, statusText } = error.response
          // 从标准响应中提取业务码
          const bizCode: number | string | undefined = ( typeof data === 'object' && data && 'code' in data ? ( data as { code?: number | string } ).code : undefined )
          const message = ( typeof data === 'object' && data && 'message' in data ? ( data as { message?: string } ).message : undefined ) || statusText || `HTTP ${status} Error`
          const apiErr = new ApiError( message, status, data, error.response )
          // 附加语义字段
          apiErr.httpStatus = status
          if ( bizCode !== undefined ) apiErr.bizCode = bizCode
          // 为兼容前端逻辑，code 取 httpStatus（403/404 判断）
          apiErr.code = status
          throw apiErr
        } else if ( error.request ) {
          // 请求已发出但没有收到响应
          throw new ApiError( '网络错误，请检查网络连接', 0, null )
        } else {
          // 请求配置出错
          throw new ApiError( error.message || '请求配置错误', 0, null )
        }
      }
    )
  }

  // 默认错误处理函数
  private getDefaultErrorHandler (): ErrorHandler {
    if ( typeof window !== 'undefined' ) {
      // 浏览器环境
      return ( error: unknown ) => {
        console.error( 'API请求错误:', error )
        // 如果有antd message组件，可以在这里使用
        // message?.error?.(error.message || '请求失败');
      }
    } else {
      // Node.js环境
      return ( error: unknown ) => {
        console.error( 'API请求错误:', error )
      }
    }
  }

  // 设置全局错误处理
  setDefaultErrorHandler ( handler: ErrorHandler ): void {
    this.defaultErrorHandler = handler
  }

  // 执行请求 - 成功返回data，失败抛出错误
  async request<T = unknown> ( url: string, options: RequestOptions = {} ): Promise<T> {
    const {
      method = 'GET',
      data,
      params,
      customError = false,
      customErrorHandler,
      ...restOptions
    } = options

    try {
      const config: AxiosRequestConfig = {
        url,
        method,
        params,
        ...restOptions
      }

      if ( ['POST', 'PUT', 'PATCH'].includes( method ) && data ) {
        config.data = data
      }

      const response: AxiosResponse<ApiResponse<T>> = await this.axiosInstance.request( config )

      // 处理响应数据
      return this.handleResponse<T>( response )
    } catch ( error: unknown ) {
      // 错误处理
      let realError: Error
      if ( error instanceof Error ) {
        realError = error
      } else {
        realError = new Error( typeof error === 'string' ? error : JSON.stringify( error ) )
      }
      if ( !customError ) {
        if ( customErrorHandler ) {
          customErrorHandler( realError, { url, options } )
        } else {
          this.defaultErrorHandler( realError, { url, options } )
        }
      }

      throw realError
    }
  }

  // 处理响应数据 - 成功返回data，失败抛出业务错误
  private handleResponse<T> ( response: AxiosResponse<ApiResponse<T>> ): T {
    const { data: responseData } = response

    // 如果响应数据不是我们期望的格式，直接返回原始数据
    if ( !responseData || typeof responseData !== 'object' ) {
      return responseData as unknown as T
    }

    // 检查是否是标准的ApiResponse格式
    if ( 'success' in responseData ) {
      const apiResponse = responseData

      // 业务成功，返回data
      if ( apiResponse.success ) {
        return apiResponse.data
      }

      // 业务失败，抛出业务错误（优先取 HTTP 状态码，附加 bizCode）
      const apiErr = new ApiError(
        apiResponse.message || '业务处理失败',
        response.status,
        apiResponse.data,
        response
      )
      apiErr.httpStatus = response.status
      apiErr.bizCode = apiResponse.code
      // 维持 code 优先为 httpStatus
      apiErr.code = response.status
      throw apiErr
    }

    // 非标准格式，直接返回
    return responseData as unknown as T
  }

  // 便捷方法 - 直接返回data
  async get<T = unknown> ( url: string, options?: Omit<RequestOptions, 'method' | 'data'> ): Promise<T> {
    return await this.request<T>( url, { ...options, method: 'GET' } )
  }

  async post<T = unknown> ( url: string, data?: unknown, options?: Omit<RequestOptions, 'method'> ): Promise<T> {
    return await this.request<T>( url, { ...options, method: 'POST', data } )
  }

  async put<T = unknown> ( url: string, data?: unknown, options?: Omit<RequestOptions, 'method'> ): Promise<T> {
    return await this.request<T>( url, { ...options, method: 'PUT', data } )
  }

  async delete<T = unknown> ( url: string, options?: Omit<RequestOptions, 'method' | 'data'> ): Promise<T> {
    return await this.request<T>( url, { ...options, method: 'DELETE' } )
  }

  async patch<T = unknown> ( url: string, data?: unknown, options?: Omit<RequestOptions, 'method'> ): Promise<T> {
    return await this.request<T>( url, { ...options, method: 'PATCH', data } )
  }

  // 获取axios实例
  getInstance (): AxiosInstance {
    return this.axiosInstance
  }

  // 原始请求方法 - 返回完整的ApiResponse（用于需要获取完整响应的场景）
  async requestRaw<T = unknown> ( url: string, options: RequestOptions = {} ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      data,
      params,
      customError = false,
      customErrorHandler,
      ...restOptions
    } = options

    try {
      const config: AxiosRequestConfig = {
        url,
        method,
        params,
        ...restOptions
      }

      if ( ['POST', 'PUT', 'PATCH'].includes( method ) && data ) {
        config.data = data
      }

      const response: AxiosResponse<ApiResponse<T>> = await this.axiosInstance.request( config )

      // 返回完整的ApiResponse
      return this.handleRawResponse<T>( response )
    } catch ( error: unknown ) {
      // 错误处理
      let realError: Error
      if ( error instanceof Error ) {
        realError = error
      } else {
        realError = new Error( typeof error === 'string' ? error : JSON.stringify( error ) )
      }
      if ( !customError ) {
        if ( customErrorHandler ) {
          customErrorHandler( realError, { url, options } )
        } else {
          this.defaultErrorHandler( realError, { url, options } )
        }
      }

      throw error
    }
  }

  // 处理原始响应数据
  private handleRawResponse<T> ( response: AxiosResponse<ApiResponse<T>> ): ApiResponse<T> {
    const { data } = response

    // 如果响应数据不是我们期望的格式，进行适配
    if ( !data || typeof data !== 'object' ) {
      return {
        success: response.status >= 200 && response.status < 300,
        code: response.status,
        data: data as unknown as T,
        message: response.statusText
      }
    }

    // 确保返回统一的数据结构
    return {
      success: data.success ?? ( response.status >= 200 && response.status < 300 ),
      code: data.code ?? response.status,
      data: data.data,
      message: data.message || response.statusText
    }
  }
}

// 使用示例
/*
const apiClient = new ApiClient({
  baseURL: 'http://localhost:3000',
  defaultErrorHandler: (error) => {
    // 全局错误处理
    message.error(error.message);
  }
});

// 使用方式：
try {
  // 成功时直接获取data
  const datasources = await apiClient.get<Datasource[]>('/api/datasources');
  console.log(datasources); // 直接是数组数据

  // 创建数据源
  const newDatasource = await apiClient.post<Datasource>('/api/datasources', {
    name: 'test',
    type: 'MYSQL',
    config: { host: 'localhost' }
  });
  console.log(newDatasource); // 直接是创建的数据源对象

} catch (error) {
  if (error instanceof ApiError) {
    // 处理API错误
    console.error('API错误:', error.message);
    console.error('错误码:', error.code);
    console.error('错误数据:', error.data);
  } else {
    // 处理其他错误
    console.error('未知错误:', error);
  }
}

// 如果需要获取完整响应（包括success、code等）
try {
  const response = await apiClient.requestRaw<Datasource[]>('/api/datasources');
  console.log(response.success, response.data, response.message);
} catch (error) {
  // 错误处理
}
*/
