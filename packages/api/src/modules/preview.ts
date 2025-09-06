import { get, post } from '../index'
import type { RequestOptions } from '../types'
import type { Dashboard } from '@lumina/types'

export const previewApi = {
  getDashboardPublic: async (
    id: number | string,
    opts?: { orgId?: string | number, token?: string },
    requestOptions?: Omit<RequestOptions, 'method' | 'data' | 'params'>
  ) => {
    const params: Record<string, string | number> = {}
    // 若存在 token，以 token 为准；避免再传 orgId 导致不一致
    if ( opts?.token ) params.token = opts.token
    else if ( opts?.orgId ) params.orgId = opts.orgId
    return await get<Dashboard>( `/api/public/dashboards/${id}` as string, { params, ...( requestOptions || {} ) } )
  },
  getViewDataPublic: async (
    id: number | string,
    body?: Record<string, unknown>,
    opts?: { orgId?: string | number, token?: string },
    requestOptions?: Omit<RequestOptions, 'method' | 'params'>
  ) => {
    const params: Record<string, string | number> = {}
    if ( opts?.token ) params.token = opts.token
    else if ( opts?.orgId ) params.orgId = opts.orgId
    return await post( `/api/public/views/${id}/data`, body ?? {}, { params, ...( requestOptions || {} ) } )
  },
  getViewConfigPublic: async (
    id: number | string,
    opts?: { orgId?: string | number, token?: string },
    requestOptions?: Omit<RequestOptions, 'method' | 'data' | 'params'>
  ) => {
    const params: Record<string, string | number> = {}
    if ( opts?.token ) params.token = opts.token
    else if ( opts?.orgId ) params.orgId = opts.orgId
    return await get<import( '@lumina/types' ).ViewConfig>( `/api/public/views/${id}/config`, { params, ...( requestOptions || {} ) } )
  },
  getViewDetailPublic: async (
    id: number | string,
    opts?: { orgId?: string | number, token?: string },
    requestOptions?: Omit<RequestOptions, 'method' | 'data' | 'params'>
  ) => {
    const params: Record<string, string | number> = {}
    if ( opts?.token ) params.token = opts.token
    else if ( opts?.orgId ) params.orgId = opts.orgId
    return await get( `/api/public/views/${id}/detail` as string, { params, ...( requestOptions || {} ) } )
  }
}
