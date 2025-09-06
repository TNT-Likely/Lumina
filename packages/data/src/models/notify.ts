// src/lib/models/notify.ts
import { DataTypes, Model, type Optional, type Sequelize } from 'sequelize'
import { NotificationConfig, NotificationType } from '@lumina/types'

interface NotifyAttributes {
  id: number
  name: string
  type: NotificationType
  config: NotificationConfig
  orgId?: number
  ownerId?: number
  visibility?: 'private' | 'org' | 'public'
  createdAt?: Date
  updatedAt?: Date
}

interface NotifyCreationAttributes extends Optional<NotifyAttributes, 'id'> {}

export class Notify extends Model<NotifyAttributes, NotifyCreationAttributes> implements NotifyAttributes {
  public id!: number
  public name!: string
  public type!: NotificationType
  public config!: NotificationConfig
  public orgId?: number
  public ownerId?: number
  public visibility?: 'private' | 'org' | 'public'
  public readonly createdAt!: Date
  public readonly updatedAt!: Date
}

export const initNotifyModel = ( sequelize: Sequelize ): void => {
  Notify.init( {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
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
    orgId: { type: DataTypes.INTEGER, allowNull: true, field: 'org_id' },
    ownerId: { type: DataTypes.INTEGER, allowNull: true, field: 'owner_id' },
    visibility: { type: DataTypes.ENUM( 'private', 'org', 'public' ), allowNull: true, defaultValue: 'org' }
  }, {
    sequelize,
    modelName: 'notify',
    tableName: 'notifies'
  } )
}
