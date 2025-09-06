import { DataTypes, Model, Optional, type Sequelize } from 'sequelize'

export interface UserAttributes {
  id: number
  email: string
  username: string
  displayName?: string | null
  avatarUrl?: string | null
  passwordHash: string
  status: 'active' | 'disabled'
  lastLoginAt?: Date | null
  createdAt?: Date
  updatedAt?: Date
}

export interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'status' | 'lastLoginAt'> {
  password?: string
}

export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number
  public email!: string
  public username!: string
  public displayName!: string | null
  public avatarUrl!: string | null
  public passwordHash!: string
  public status!: 'active' | 'disabled'
  public lastLoginAt!: Date | null
  public readonly createdAt!: Date
  public readonly updatedAt!: Date
}

export const initUserModel = ( sequelize: Sequelize ): void => {
  User.init( {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    email: {
      type: DataTypes.STRING( 255 ),
      allowNull: false,
      unique: true,
      validate: { isEmail: true }
    },
    username: {
      type: DataTypes.STRING( 100 ),
      allowNull: false,
      unique: true,
      validate: { len: [3, 100] }
    },
    displayName: {
      type: DataTypes.STRING( 100 ),
      allowNull: true,
      field: 'display_name'
    },
    avatarUrl: {
      type: DataTypes.STRING( 512 ),
      allowNull: true,
      field: 'avatar_url'
    },
    passwordHash: {
      type: DataTypes.STRING( 255 ),
      allowNull: false,
      field: 'password_hash'
    },
    status: {
      type: DataTypes.ENUM( 'active', 'disabled' ),
      allowNull: false,
      defaultValue: 'active'
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_login_at'
    }
  }, {
    sequelize,
    modelName: 'user',
    tableName: 'users',
    indexes: [
      { unique: true, fields: ['email'] },
      { unique: true, fields: ['username'] }
    ]
  } )
}

export default User
