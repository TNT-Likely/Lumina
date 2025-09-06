import { get, post, put } from '..'

export interface UserProfileDTO {
  id: number
  username: string
  email: string
  avatar?: string | null
  displayName?: string | null
}

export const UserApi = {
  async search ( q: string ) {
    return await get<Array<{ id: number, email: string, username: string, displayName?: string|null, avatarUrl?: string|null }>>( '/api/users/search', { params: { q } } )
  },
  async profile (): Promise<UserProfileDTO | null> {
    const res = await get<UserProfileDTO | null>( '/api/me' )
    return res || null
  },
  async updateProfile ( payload: Partial<{ displayName: string, avatarUrl: string }> ) {
    return await put( '/api/me', payload )
  },
  async changePassword ( oldPassword: string, newPassword: string ) {
    return await post( '/api/me/change-password', { oldPassword, newPassword } )
  }
}
