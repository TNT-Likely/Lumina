import { DataTypes, Model, Optional, type Sequelize } from 'sequelize'

export interface MessageConsumeLogAttributes {
  id: number;
  type: string; // 消息类型，如 subscription、alert 等
  messageId: string;
  refId: number; // 业务主键，如 subscriptionId、alertId
  consumedAt: Date;
}

export interface MessageConsumeLogCreationAttributes extends Optional<MessageConsumeLogAttributes, 'id' | 'consumedAt'> {}

export class MessageConsumeLog extends Model<MessageConsumeLogAttributes, MessageConsumeLogCreationAttributes>
  implements MessageConsumeLogAttributes {
  public id!: number
  public type!: string
  public messageId!: string
  public refId!: number
  public consumedAt!: Date
}

export const initMessageConsumeLogModel = ( sequelize: Sequelize ): void => {
  MessageConsumeLog.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
      },
      type: {
        type: DataTypes.STRING( 32 ),
        allowNull: false
      },
      messageId: {
        type: DataTypes.STRING( 128 ),
        allowNull: false,
        unique: true
      },
      refId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false
      },
      consumedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    },
    {
      tableName: 'message_consume_log',
      sequelize,
      timestamps: false
    }
  )
}

export default MessageConsumeLog
