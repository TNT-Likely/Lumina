import { User, Organization, OrganizationMember } from '../models'
import bcrypt from 'bcryptjs'

export async function seedAdminIfNeeded () {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@lumina.local'
  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
  const exists = await User.findOne( { where: { username: adminUsername } } )
  let admin = exists
  if ( !admin ) {
    const passwordHash = await bcrypt.hash( adminPassword, 10 )
    admin = await User.create( { email: adminEmail, username: adminUsername, passwordHash, status: 'active' } )
    // eslint-disable-next-line no-console
    console.log( `[data] seeded default admin user: ${adminUsername}/${adminPassword}` )
  }

  // ensure default org exists
  let org = await Organization.findOne( { where: { slug: 'default' } } )
  if ( !org ) {
    org = await Organization.create( { name: '默认组织', slug: 'default' } )
    // eslint-disable-next-line no-console
    console.log( '[data] seeded default organization: default' )
  }
  // ensure admin is ADMIN member of default org
  if ( admin && org ) {
    const [member] = await OrganizationMember.findOrCreate( {
      where: { orgId: org.id, userId: admin.id },
      defaults: { orgId: org.id, userId: admin.id, role: 'ADMIN' }
    } )
    if ( member.role !== 'ADMIN' ) await member.update( { role: 'ADMIN' } )
  }
}
