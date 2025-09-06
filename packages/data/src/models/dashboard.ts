// src/lib/models/dashboard.ts
import { DataTypes, Model, type Optional, type Sequelize } from 'sequelize'

interface DashboardAttributes {
  id: number
  name: string
  description?: string
  config: object
    orgId?: number
    ownerId?: number
    visibility?: 'private' | 'org' | 'public'
  createdAt?: Date
  updatedAt?: Date
}

interface DashboardCreationAttributes extends Optional<DashboardAttributes, 'id'> {}

export class Dashboard extends Model<DashboardAttributes, DashboardCreationAttributes> implements DashboardAttributes {
  public id!: number
  public name!: string
  public description?: string
  public config!: object
  public orgId?: number
  public ownerId?: number
  public visibility?: 'private' | 'org' | 'public'
  public readonly createdAt!: Date
  public readonly updatedAt!: Date
}

export const initDashboardModel = ( sequelize: Sequelize ): void => {
  Dashboard.init( {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    config: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {
        components: [],
        settings: {
          grid: {
            cols: 12,
            rowHeight: 40,
            margin: [8, 8]
          },
          theme: {
            backgroundColor: '#f5f7fa',
            primaryColor: '#4f46e5'
          }
        },
        filters: [],
        version: '1.0.0'
      }
    },
    orgId: { type: DataTypes.INTEGER, allowNull: true, field: 'org_id' },
    ownerId: { type: DataTypes.INTEGER, allowNull: true, field: 'owner_id' },
    visibility: { type: DataTypes.ENUM( 'private', 'org', 'public' ), allowNull: true, defaultValue: 'org' }
  }, {
    sequelize,
    modelName: 'dashboard',
    tableName: 'dashboards'
  } )
}
