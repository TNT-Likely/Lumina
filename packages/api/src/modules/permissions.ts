import { post } from '../index'

export type ResourceType = 'dashboard' | 'view' | 'dataset' | 'datasource'

export interface PermissionCheckItem { type: ResourceType, id: number }
export interface PermissionResult { type: ResourceType, id: number, read: boolean, write: boolean, delete: boolean }

export const permissionsApi = {
  async batch ( items: PermissionCheckItem[] ) {
    return await post< PermissionResult[] >( '/api/permissions:batch', { items } )
  }
}
