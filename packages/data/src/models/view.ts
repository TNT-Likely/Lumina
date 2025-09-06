// src/lib/models/view.ts
import { DataTypes, Model, type Optional, type Sequelize } from 'sequelize'

interface ViewAttributes {
  id: number
  name: string
  datasetId: number
  description: string
  type: string
  config: object
  orgId?: number
  ownerId?: number
  visibility?: 'private' | 'org' | 'public'
  createdAt?: Date
  updatedAt?: Date
}

interface ViewCreationAttributes extends Optional<ViewAttributes, 'id'> {}

export class View extends Model<ViewAttributes, ViewCreationAttributes> implements ViewAttributes {
  public id!: number
  public name!: string
  public datasetId!: number
  public description!: string
  public type!: string
  public config!: object
  public orgId?: number
  public ownerId?: number
  public visibility?: 'private' | 'org' | 'public'
  public readonly createdAt!: Date
  public readonly updatedAt!: Date
}

export const initViewModel = ( sequelize: Sequelize ): void => {
  View.init( {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true // 添加自增
    },
    datasetId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'dataset_id',
      references: {
        model: 'datasets',
        key: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.STRING,
      allowNull: false
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'chart'
    },
    config: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {}
    },
    orgId: { type: DataTypes.INTEGER, allowNull: true, field: 'org_id' },
    ownerId: { type: DataTypes.INTEGER, allowNull: true, field: 'owner_id' },
    visibility: { type: DataTypes.ENUM( 'private', 'org', 'public' ), allowNull: true, defaultValue: 'org' }
  }, {
    sequelize,
    modelName: 'view',
    tableName: 'views'
  } )
}
