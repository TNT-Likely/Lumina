// src/lib/models/subscribe.ts
import { DataTypes, Model, type Optional, type Sequelize } from 'sequelize'
import type { SubscriptionConfig } from '@lumina/types'

interface SubscribeAttributes {
  id: number
  name: string
  dashboardId: number
  notifyIds: number[]
  enabled: boolean
  config: SubscriptionConfig
  orgId?: number
  ownerId?: number
  visibility?: 'private' | 'org' | 'public'
  createdAt?: string
  updatedAt?: string
}

interface SubscribeCreationAttributes extends Optional<SubscribeAttributes, 'id'> {}

export class Subscribe extends Model<SubscribeAttributes, SubscribeCreationAttributes> implements SubscribeAttributes {
  public id!: number
  public name!: string
  public dashboardId!: number
  public notifyIds!: number[]
  public enabled!: boolean
  public config!: SubscriptionConfig
  public orgId?: number
  public ownerId?: number
  public visibility?: 'private' | 'org' | 'public'
  public readonly createdAt!: string
  public readonly updatedAt!: string
}

export const initSubscribeModel = ( sequelize: Sequelize ): void => {
  Subscribe.init( {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    dashboardId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'dashboard_id',
      references: {
        model: 'dashboards',
        key: 'id'
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE'
    },
    notifyIds: {
      type: DataTypes.JSON,
      allowNull: false,
      field: 'notify_ids',
      defaultValue: []
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
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
    modelName: 'subscribe',
    tableName: 'subscribes'
  } )
}
