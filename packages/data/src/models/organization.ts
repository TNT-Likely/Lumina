import { DataTypes, Model, Optional, type Sequelize } from 'sequelize'

export interface OrganizationAttributes {
  id: number
  name: string
  slug: string
  createdAt?: Date
  updatedAt?: Date
}

export interface OrganizationCreationAttributes extends Optional<OrganizationAttributes, 'id'> {}

export class Organization extends Model<OrganizationAttributes, OrganizationCreationAttributes> implements OrganizationAttributes {
  public id!: number
  public name!: string
  public slug!: string
  public readonly createdAt!: Date
  public readonly updatedAt!: Date
}

export const initOrganizationModel = ( sequelize: Sequelize ): void => {
  Organization.init( {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING( 100 ), allowNull: false },
    slug: { type: DataTypes.STRING( 100 ), allowNull: false, unique: true }
  }, { sequelize, modelName: 'organization', tableName: 'organizations' } )
}

export default Organization
