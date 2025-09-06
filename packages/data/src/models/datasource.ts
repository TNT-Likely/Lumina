// src/lib/models/datasource.ts
import { DataTypes, Model, type Optional, type Sequelize } from 'sequelize'

interface DatasourceAttributes {
  id: number
  name: string
  type: string
  config: object
  orgId?: number
  ownerId?: number
  visibility?: 'private' | 'org' | 'public'
  createdAt?: Date
  updatedAt?: Date
}

interface DatasourceCreationAttributes extends Optional<DatasourceAttributes, 'id'> {}

export class Datasource extends Model<DatasourceAttributes, DatasourceCreationAttributes> implements DatasourceAttributes {
  public id!: number
  public name!: string
  public type!: string
  public config!: object
  public orgId?: number
  public ownerId?: number
  public visibility?: 'private' | 'org' | 'public'
  public readonly createdAt!: Date
  public readonly updatedAt!: Date
}

export const initDatasourceModel = ( sequelize: Sequelize ): void => {
  Datasource.init( {
    // 修改后
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true // 添加自增
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false
    },
    config: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {}
    },
    orgId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'org_id'
    },
    ownerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'owner_id'
    },
    visibility: {
      type: DataTypes.ENUM( 'private', 'org', 'public' ),
      allowNull: true,
      defaultValue: 'org'
    }
  }, {
    sequelize,
    modelName: 'datasource',
    tableName: 'datasources'
  } )
}
