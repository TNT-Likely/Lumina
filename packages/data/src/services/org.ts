import { Organization, OrganizationMember } from '../models'

export interface UserOrgItem {
  id: number
  name: string
  slug: string
  role: string
}

export const orgService = {
  async listUserOrgs ( userId: number ): Promise<UserOrgItem[]> {
    const memberships = await OrganizationMember.findAll( {
      where: { userId },
      include: [{ model: Organization, as: 'org' }]
    } )
    return memberships
      .map( m => {
        // @ts-expect-error association present at runtime
        const org = m.org as Organization | undefined
        if ( !org ) return null
        return { id: org.id, name: org.name, slug: org.slug, role: m.role }
      } )
      .filter( Boolean ) as UserOrgItem[]
  }
}

export default orgService
