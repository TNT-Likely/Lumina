import { Op } from 'sequelize'
import crypto from 'crypto'
import { User } from '../models'

export interface PublicUserItem {
  id: number
  email: string
  username: string
  displayName?: string | null
  avatarUrl?: string | null
}

export interface UserProfileDTO {
  id: number
  username: string
  email: string
  avatar?: string | null
  displayName?: string | null
}

export const userService = {
  async searchUsers ( q: string, limit = 20 ): Promise<PublicUserItem[]> {
    const where = q
      ? {
        [Op.or]: [
          // sqlite 不支持 iLike，这里用 LIKE；若是 PG 会将 iLike 断言为 symbol 以通过类型检查
          { email: { [( Op.iLike ?? Op.like ) as unknown as symbol]: `%${q}%` } },
          { username: { [( Op.iLike ?? Op.like ) as unknown as symbol]: `%${q}%` } }
        ]
      }
      : {}
    const rows = await User.findAll( {
      where,
      limit,
      order: [['id', 'ASC']],
      attributes: ['id', 'email', 'username', 'displayName', 'avatarUrl']
    } )
    return rows.map( r => ( {
      id: r.id,
      email: r.email,
      username: r.username,
      displayName: r.displayName ?? null,
      avatarUrl: r.avatarUrl ?? null
    } ) )
  },

  async getProfile ( userId: number ): Promise<UserProfileDTO | null> {
    const user = await User.findByPk( userId )
    if ( !user ) return null
    const gravatar = user.email
      ? `https://www.gravatar.com/avatar/${crypto.createHash( 'md5' ).update( user.email.trim().toLowerCase() ).digest( 'hex' )}?d=identicon`
      : null
    const avatar = user.avatarUrl || gravatar
    return { id: user.id, username: user.username, email: user.email, avatar, displayName: user.displayName || null }
  }
}

export default userService
