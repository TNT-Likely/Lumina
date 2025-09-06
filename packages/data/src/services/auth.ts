import { User, AuthToken } from '../models'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export const authService = {
  async register ( params: { email: string, username: string, password: string } ) {
    const { email, username, password } = params
    const exists = ( await User.findOne( { where: { email } } ) ) || ( await User.findOne( { where: { username } } ) )
    if ( exists ) throw new Error( '用户已存在' )
    const passwordHash = await bcrypt.hash( password, 10 )
    // 在测试环境下，直接激活，避免依赖邮件验证流程
    const initialStatus: 'active' | 'disabled' = process.env.NODE_ENV === 'test' ? 'active' : 'disabled'
    const user = await User.create( { email, username, passwordHash, status: initialStatus } )
    return user
  },

  async verifyPassword ( identifier: string, password: string ) {
    const user = await this.findByUsernameOrEmail( identifier )
    if ( !user ) return null
    if ( user.status !== 'active' ) throw new Error( '用户已禁用' )
    const ok = await bcrypt.compare( password, user.passwordHash )
    if ( !ok ) return null
    return user
  },

  async findByUsernameOrEmail ( identifier: string ) {
    const user = await User.findOne( { where: { username: identifier } } ) || await User.findOne( { where: { email: identifier } } )
    return user
  },

  async updateLastLogin ( userId: number ) {
    await User.update( { lastLoginAt: new Date() }, { where: { id: userId } } )
  },

  async setUserStatus ( userId: number, status: 'active' | 'disabled' ) {
    await User.update( { status }, { where: { id: userId } } )
  },

  async updatePassword ( userId: number, newPassword: string ) {
    const ph = await bcrypt.hash( newPassword, 10 )
    await User.update( { passwordHash: ph }, { where: { id: userId } } )
  },

  // Email verify & reset
  async createEmailVerifyToken ( userId: number ) {
    const token = crypto.randomBytes( 24 ).toString( 'hex' )
    const ttlHours = 24
    const expiresAt = new Date( Date.now() + ttlHours * 3600 * 1000 )
    await AuthToken.create( { userId, type: 'verify', token, expiresAt } )
    return token
  },
  async markUserActive ( userId: number ) {
    await this.setUserStatus( userId, 'active' )
  },
  async createPasswordResetToken ( userId: number ) {
    const token = crypto.randomBytes( 24 ).toString( 'hex' )
    const ttlHours = 2
    const expiresAt = new Date( Date.now() + ttlHours * 3600 * 1000 )
    await AuthToken.create( { userId, type: 'reset', token, expiresAt } )
    return token
  },

  async verifyAndConsumeToken ( type: 'verify' | 'reset', token: string ) {
    const rec = await AuthToken.findOne( { where: { type, token } } )
    if ( !rec ) return null
    if ( rec.usedAt ) return null
    if ( rec.expiresAt.getTime() < Date.now() ) return null
    // mark used
    rec.usedAt = new Date()
    await rec.save()
    return rec
  }
}

export default authService
