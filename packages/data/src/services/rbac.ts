import { OrganizationMember, type OrgRole } from '../models/organizationMember'

export type Visibility = 'private' | 'org' | 'public'

export interface ResourceMeta {
  ownerId?: number | null
  visibility?: Visibility | null
}

async function getUserRoleInOrg ( userId?: number | null, orgId?: number | null ): Promise<OrgRole | null> {
  if ( !userId || !orgId ) return null
  const membership = await OrganizationMember.findOne( { where: { userId, orgId } } )
  return membership?.role ?? null
}

function isEditorOrAbove ( role: OrgRole | null ): boolean {
  return role === 'ADMIN' || role === 'EDITOR'
}

function canRead ( resource: ResourceMeta, role: OrgRole | null, currentUserId?: number | null ): boolean {
  const visibility = resource.visibility ?? 'org'
  switch ( visibility ) {
  case 'private':
    return !!currentUserId && resource.ownerId === currentUserId
  case 'org':
    return role !== null // 组织成员均可读
  case 'public':
    return true
  default:
    return false
  }
}

function canWrite ( resource: ResourceMeta, role: OrgRole | null, currentUserId?: number | null ): boolean {
  const visibility = resource.visibility ?? 'org'
  switch ( visibility ) {
  case 'private':
    return !!currentUserId && resource.ownerId === currentUserId
  case 'org':
    return isEditorOrAbove( role )
  case 'public':
    return isEditorOrAbove( role )
  default:
    return false
  }
}

// 删除权限：比写权限更严格
// - private: 仅所有者
// - org/public: 仅组织管理员
// - root: 任意资源可删（跨组织）
function canDelete ( resource: ResourceMeta, role: OrgRole | null, currentUserId?: number | null ): boolean {
  if ( isRoot( currentUserId ) ) return true
  const visibility = resource.visibility ?? 'org'
  switch ( visibility ) {
  case 'private':
    return !!currentUserId && resource.ownerId === currentUserId
  case 'org':
  case 'public':
    return role === 'ADMIN'
  default:
    return false
  }
}

// 创建权限：组织内由编辑及以上可创建；root 无视组织直接可创建
function canCreate ( role: OrgRole | null, currentUserId?: number | null ): boolean {
  if ( isRoot( currentUserId ) ) return true
  return isEditorOrAbove( role )
}

// Root 判定：默认 userId=1 为 root，可通过环境变量 LUMINA_ROOT_USER_IDS 配置（逗号分隔）
function isRoot ( userId?: number | null ): boolean {
  if ( !userId ) return false
  const env = process.env.LUMINA_ROOT_USER_IDS
  if ( env && env.trim().length > 0 ) {
    const ids = env
      .split( ',' )
      .map( s => parseInt( s.trim(), 10 ) )
      .filter( n => Number.isFinite( n ) )
    return ids.includes( Number( userId ) )
  }
  return Number( userId ) === 1
}

export const rbacService = {
  getUserRoleInOrg,
  isEditorOrAbove,
  canRead,
  canWrite,
  canDelete,
  canCreate,
  isRoot
}

export default rbacService
