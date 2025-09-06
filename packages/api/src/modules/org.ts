import { get, post, put, del, getApiClient } from '../index'

const ORG_KEY = 'lumina.orgId'

export function getSelectedOrgId (): string | null {
  try { return localStorage.getItem( ORG_KEY ) } catch { return null }
}

export function setSelectedOrgId ( orgId: string ): void {
  try { localStorage.setItem( ORG_KEY, orgId ) } catch {}
}

export function setupOrgInterceptors (): void {
  const inst = getApiClient().getInstance()
  inst.interceptors.request.use( cfg => {
    const orgId = getSelectedOrgId() || '1'
    cfg.headers = cfg.headers || {}
    // 统一注入组织上下文
    cfg.headers['X-Org-Id'] = String( orgId )
    return cfg
  } )
}

export interface OrgItem { id: number, name: string, slug: string, role: string }

export const OrgApi = {
  async listMyOrgs (): Promise<OrgItem[]> {
    return await get<OrgItem[]>( '/api/orgs' )
  },
  // Admin orgs
  async adminListOrgs () { return await get( '/api/admin/orgs' ) },
  async adminCreateOrg ( payload: { name: string, slug: string } ) { return await post<void>( '/api/admin/orgs', payload ) },
  async adminUpdateOrg ( id: number, payload: Partial<{ name: string, slug: string }> ) { return await put( `/api/admin/orgs/${id}`, payload ) },
  async adminDeleteOrg ( id: number ) { return await del( `/api/admin/orgs/${id}` ) },
  // Members
  async listMembers ( orgId: number ) { return await get( `/api/admin/orgs/${orgId}/members` ) },
  async addMember ( orgId: number, userId: number, role: 'ADMIN'|'EDITOR'|'VIEWER' ) { return await post( `/api/admin/orgs/${orgId}/members`, { userId, role } ) },
  async addMembers ( orgId: number, items: Array<{ userId: number, role: 'ADMIN'|'EDITOR'|'VIEWER' }> ) { return await post( `/api/admin/orgs/${orgId}/members:batch`, { items } ) },
  async updateMemberRole ( orgId: number, userId: number, role: 'ADMIN'|'EDITOR'|'VIEWER' ) { return await put( `/api/admin/orgs/${orgId}/members/${userId}`, { role } ) },
  async removeMember ( orgId: number, userId: number ) { return await del( `/api/admin/orgs/${orgId}/members/${userId}` ) },
  // Invites
  async listInvites ( orgId: number ) { return await get( `/api/admin/orgs/${orgId}/invites` ) },
  async createInvite ( orgId: number, email: string, role: 'ADMIN'|'EDITOR'|'VIEWER', ttlHours?: number ) { return await post( `/api/admin/orgs/${orgId}/invites`, { email, role, ttlHours } ) },
  async createInvites ( orgId: number, items: Array<{ email: string, role: 'ADMIN'|'EDITOR'|'VIEWER', ttlHours?: number }> ) { return await post( `/api/admin/orgs/${orgId}/invites:batch`, { items } ) },
  async revokeInvite ( inviteId: number ) { return await del( `/api/admin/invites/${inviteId}` ) },
  async acceptInvite ( token: string ) { return await post( `/api/invites/${token}/accept`, {} ) }
}
