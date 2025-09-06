import { DataTypes, Model, Optional, type Sequelize } from 'sequelize'

export type AuthTokenType = 'verify' | 'reset'

export interface AuthTokenAttributes {
  id: number
  userId: number
  type: AuthTokenType
  token: string
  expiresAt: Date
  usedAt?: Date | null
  createdAt?: Date
  updatedAt?: Date
}

export interface AuthTokenCreationAttributes extends Optional<AuthTokenAttributes, 'id' | 'usedAt'> {}

export class AuthToken extends Model<AuthTokenAttributes, AuthTokenCreationAttributes> implements AuthTokenAttributes {
  public id!: number
  public userId!: number
  public type!: AuthTokenType
  public token!: string
  public expiresAt!: Date
  public usedAt!: Date | null
  public readonly createdAt!: Date
  public readonly updatedAt!: Date
}

export const initAuthTokenModel = ( sequelize: Sequelize ): void => {
  AuthToken.init( {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id'
    },
    type: {
      type: DataTypes.ENUM( 'verify', 'reset' ),
      allowNull: false
    },
    token: {
      type: DataTypes.STRING( 255 ),
      allowNull: false,
      unique: true
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'expires_at'
    },
    usedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'used_at'
    }
  }, {
    sequelize,
    modelName: 'auth_token',
    tableName: 'auth_tokens',
    indexes: [
      { unique: true, fields: ['token'] },
      { fields: ['user_id'] },
      { fields: ['type'] }
    ]
  } )
}

export default AuthToken
