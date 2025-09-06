import { DataTypes, Model, Optional, type Sequelize } from 'sequelize'

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'

export interface OrganizationInvitationAttributes {
  id: number
  orgId: number
  email: string
  role: 'ADMIN' | 'EDITOR' | 'VIEWER'
  token: string
  expiresAt?: Date | null
  status: InvitationStatus
  createdAt?: Date
  updatedAt?: Date
}

export interface OrganizationInvitationCreationAttributes extends Optional<OrganizationInvitationAttributes, 'id' | 'expiresAt' | 'status'> {}

export class OrganizationInvitation extends Model<OrganizationInvitationAttributes, OrganizationInvitationCreationAttributes> implements OrganizationInvitationAttributes {
  public id!: number
  public orgId!: number
  public email!: string
  public role!: 'ADMIN' | 'EDITOR' | 'VIEWER'
  public token!: string
  public expiresAt!: Date | null
  public status!: InvitationStatus
  public readonly createdAt!: Date
  public readonly updatedAt!: Date
}

export const initOrganizationInvitationModel = ( sequelize: Sequelize ): void => {
  OrganizationInvitation.init( {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    orgId: { type: DataTypes.INTEGER, allowNull: false, field: 'org_id' },
    email: { type: DataTypes.STRING( 255 ), allowNull: false },
    role: { type: DataTypes.ENUM( 'ADMIN', 'EDITOR', 'VIEWER' ), allowNull: false, defaultValue: 'VIEWER' },
    token: { type: DataTypes.STRING( 128 ), allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: true, field: 'expires_at' },
    status: { type: DataTypes.ENUM( 'PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED' ), allowNull: false, defaultValue: 'PENDING' }
  }, {
    sequelize,
    modelName: 'organization_invitation',
    tableName: 'organization_invitations',
    indexes: [
      { unique: true, fields: ['token'] },
      { fields: ['org_id'] },
      { fields: ['email'] }
    ]
  } )
}

export default OrganizationInvitation
