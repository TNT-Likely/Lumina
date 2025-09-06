import { DataTypes, Model, Optional, type Sequelize } from 'sequelize'

export type OrgRole = 'ADMIN' | 'EDITOR' | 'VIEWER'

export interface OrganizationMemberAttributes {
  id: number
  orgId: number
  userId: number
  role: OrgRole
  createdAt?: Date
  updatedAt?: Date
}

export interface OrganizationMemberCreationAttributes extends Optional<OrganizationMemberAttributes, 'id' | 'role'> {}

export class OrganizationMember extends Model<OrganizationMemberAttributes, OrganizationMemberCreationAttributes> implements OrganizationMemberAttributes {
  public id!: number
  public orgId!: number
  public userId!: number
  public role!: OrgRole
  public readonly createdAt!: Date
  public readonly updatedAt!: Date
}

export const initOrganizationMemberModel = ( sequelize: Sequelize ): void => {
  OrganizationMember.init( {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    orgId: { type: DataTypes.INTEGER, allowNull: false, field: 'org_id' },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
    role: { type: DataTypes.ENUM( 'ADMIN', 'EDITOR', 'VIEWER' ), allowNull: false, defaultValue: 'ADMIN' }
  }, {
    sequelize,
    modelName: 'organization_member',
    tableName: 'organization_members',
    indexes: [
      { unique: true, fields: ['org_id', 'user_id'] }
    ]
  } )
}

export default OrganizationMember
