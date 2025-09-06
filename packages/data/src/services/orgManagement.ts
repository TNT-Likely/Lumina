import { Organization, OrganizationMember, OrganizationInvitation, User } from '../models'
import { Op } from 'sequelize'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export const orgManagementService = {
  // Orgs
  async listOrgs () {
    return await Organization.findAll( { order: [['id', 'ASC']] } )
  },
  // 仅列出当前用户作为 ADMIN 的组织
  async listOrgsForAdmin ( userId: number ) {
    return await Organization.findAll( {
      include: [{
        model: OrganizationMember,
        as: 'members',
        where: { userId, role: 'ADMIN' }
      }],
      order: [['id', 'ASC']]
    } )
  },
  async createOrg ( payload: { name: string, slug: string } ) {
    return await Organization.create( payload )
  },
  async updateOrg ( id: number, payload: Partial<{ name: string, slug: string }> ) {
    const org = await Organization.findByPk( id )
    if ( !org ) return null
    return await org.update( payload )
  },
  async deleteOrg ( id: number ) {
    const org = await Organization.findByPk( id )
    if ( !org ) return false
    await org.destroy()
    return true
  },

  // Members
  async listMembers ( orgId: number ) {
    const rows = await OrganizationMember.findAll( {
      where: { orgId },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'email', 'username', 'displayName', 'avatarUrl']
      }]
    } )
    // 规整返回，避免泄露无关字段
    return rows.map( r => {
      // @ts-expect-error association present at runtime
      const u = r.user as User | undefined
      return {
        orgId: r.orgId,
        userId: r.userId,
        role: r.role,
        user: u
          ? {
            id: u.id,
            email: u.email,
            username: u.username,
            displayName: u.displayName ?? null,
            avatarUrl: u.avatarUrl ?? null
          }
          : undefined
      }
    } )
  },
  async getMember ( orgId: number, userId: number ) {
    return await OrganizationMember.findOne( { where: { orgId, userId } } )
  },
  async addMember ( orgId: number, userId: number, role: 'ADMIN'|'EDITOR'|'VIEWER' = 'VIEWER' ) {
    return await OrganizationMember.create( { orgId, userId, role } )
  },
  async addMembers ( orgId: number, items: Array<{ userId: number, role: 'ADMIN'|'EDITOR'|'VIEWER' }> ) {
    if ( !Array.isArray( items ) || items.length === 0 ) return []
    const rows = items.map( i => ( { orgId, userId: Number( i.userId ), role: i.role } ) )
    return await OrganizationMember.bulkCreate( rows, { ignoreDuplicates: true } )
  },
  async updateMemberRole ( orgId: number, userId: number, role: 'ADMIN'|'EDITOR'|'VIEWER' ) {
    const m = await OrganizationMember.findOne( { where: { orgId, userId } } )
    if ( !m ) return null
    return await m.update( { role } )
  },
  async removeMember ( orgId: number, userId: number ) {
    const m = await OrganizationMember.findOne( { where: { orgId, userId } } )
    if ( !m ) return false
    await m.destroy()
    return true
  },

  // Invitations
  async listInvites ( orgId: number ) {
    return await OrganizationInvitation.findAll( { where: { orgId }, order: [['id', 'DESC']] } )
  },
  async createInvite ( orgId: number, email: string, role: 'ADMIN'|'EDITOR'|'VIEWER' = 'VIEWER', ttlHours = 72 ) {
    const token = crypto.randomBytes( 24 ).toString( 'hex' )
    const expiresAt = new Date( Date.now() + ttlHours * 3600 * 1000 )
    return await OrganizationInvitation.create( { orgId, email, role, token, expiresAt } )
  },
  async createInvites ( orgId: number, payload: Array<{ email: string, role: 'ADMIN'|'EDITOR'|'VIEWER', ttlHours?: number }> ) {
    if ( !Array.isArray( payload ) || payload.length === 0 ) return []
    const rows = payload.map( p => ( {
      orgId,
      email: p.email,
      role: p.role,
      token: crypto.randomBytes( 24 ).toString( 'hex' ),
      expiresAt: new Date( Date.now() + ( p.ttlHours ?? 72 ) * 3600 * 1000 )
    } ) )
    return await OrganizationInvitation.bulkCreate( rows )
  },
  async revokeInvite ( id: number ) {
    const inv = await OrganizationInvitation.findByPk( id )
    if ( !inv ) return false
    await inv.update( { status: 'REVOKED' } )
    return true
  },
  async acceptInvite ( token: string, userId: number ) {
    const inv = await OrganizationInvitation.findOne( { where: { token } } )
    if ( !inv ) throw new Error( '邀请不存在' )
    if ( inv.status !== 'PENDING' ) throw new Error( '邀请已失效' )
    if ( inv.expiresAt && inv.expiresAt.getTime() < Date.now() ) {
      await inv.update( { status: 'EXPIRED' } )
      throw new Error( '邀请已过期' )
    }
    // 邮箱强校验：当前用户邮箱需与邀请邮箱一致
    const user = await User.findByPk( userId )
    if ( !user ) throw new Error( '用户不存在' )
    const userEmail = ( user.email || '' ).trim().toLowerCase()
    const inviteEmail = ( inv.email || '' ).trim().toLowerCase()
    if ( !userEmail || userEmail !== inviteEmail ) {
      throw new Error( '邀请邮箱与当前用户邮箱不匹配' )
    }
    await OrganizationMember.findOrCreate( {
      where: { orgId: inv.orgId, userId },
      // defaults 需要包含必填列（orgId、userId）以满足类型检查
      defaults: { orgId: inv.orgId, userId, role: inv.role }
    } )
    await inv.update( { status: 'ACCEPTED' } )
    return true
  },

  // User profile
  async updateProfile ( userId: number, payload: Partial<{ displayName: string, avatarUrl: string }> ) {
    const user = await User.findByPk( userId )
    if ( !user ) return null
    return await user.update( {
      displayName: payload.displayName,
      avatarUrl: payload.avatarUrl
    } )
  },
  async changePassword ( userId: number, oldPassword: string, newPassword: string ) {
    const user = await User.findByPk( userId )
    if ( !user ) throw new Error( '用户不存在' )
    const ok = await bcrypt.compare( oldPassword, user.passwordHash )
    if ( !ok ) throw new Error( '原密码不正确' )
    const ph = await bcrypt.hash( newPassword, 10 )
    await user.update( { passwordHash: ph } )
    return true
  }
}

export default orgManagementService
