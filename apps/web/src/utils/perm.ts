export type OrgRole = 'ADMIN' | 'EDITOR' | 'VIEWER' | null | undefined

export const canCreate = (role: OrgRole) => role === 'ADMIN' || role === 'EDITOR'

export const isOwner = (userId?: number | null, ownerId?: number | null) => {
  return !!userId && !!ownerId && Number(userId) === Number(ownerId)
}
